// Auto Publisher scheduler: a daily generation run that creates N drafts spread
// across a publish-time window, plus a periodic sweep that publishes anything
// approved and due. Both are gated by the single `enabled` toggle in settings.
import cron, { type ScheduledTask } from "node-cron";
import { db } from "../db";
import { autoPublishSettings, type AutoPublishSettings } from "@shared/schema";
import { storage } from "../storage";
import { generateAndCreateArticle, AUTO_PUBLISHER_AUTHOR_ID } from "./articleGeneration";
import { publishContentItemFull } from "./publishArticle";

export const AUTO_PUBLISH_TAG = "auto-publish";
const SWEEP_CRON_EXPRESSION = "*/5 * * * *"; // every 5 minutes

let generationTask: ScheduledTask | null = null;
let sweepTask: ScheduledTask | null = null;

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getOrCreateAutoPublishSettings(): Promise<AutoPublishSettings> {
  const rows = await db.select().from(autoPublishSettings).limit(1);
  if (rows.length > 0) return rows[0];
  const [row] = await db.insert(autoPublishSettings).values({}).returning();
  return row;
}

// ── Timezone-aware time math ────────────────────────────────────────────────

/** "YYYY-MM-DD" for "now" as seen in the given IANA timezone. */
function todayDateStringInTz(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Converts a "YYYY-MM-DD" + "HH:MM" wall-clock time in `timeZone` to an absolute UTC Date. */
function zonedTimeToUtc(dateStr: string, hhmm: string, timeZone: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const asIfUtc = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const tzString = asIfUtc.toLocaleString("en-US", { timeZone });
  const utcString = asIfUtc.toLocaleString("en-US", { timeZone: "UTC" });
  const offsetMs = new Date(utcString).getTime() - new Date(tzString).getTime();
  return new Date(asIfUtc.getTime() + offsetMs);
}

/** Spreads `count` timestamps evenly across [windowStart, windowEnd] on `dateStr`, in `timeZone`. */
export function computePublishTimes(
  dateStr: string,
  windowStart: string,
  windowEnd: string,
  count: number,
  timeZone: string,
): Date[] {
  if (count <= 0) return [];
  const start = zonedTimeToUtc(dateStr, windowStart, timeZone);
  const end = zonedTimeToUtc(dateStr, windowEnd, timeZone);
  const spanMs = Math.max(end.getTime() - start.getTime(), 0);
  if (count === 1) return [new Date(start.getTime() + spanMs / 2)];
  const stepMs = spanMs / count;
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + stepMs * i + stepMs / 2));
}

// ── Daily generation run ────────────────────────────────────────────────────

// Note: does NOT check settings.enabled — that gate controls whether the daily cron
// job is scheduled at all (see scheduleGenerationTask below). This function itself
// stays callable regardless, so "Run now" works as a manual override even while the
// automatic schedule is off — which is the entire point of a "run once to test" button.
export async function runDailyGeneration(): Promise<void> {
  const settings = await getOrCreateAutoPublishSettings();
  const count = settings.articlesPerDay ?? 1;
  const dateStr = todayDateStringInTz(settings.timezone || "America/New_York");
  const publishTimes = computePublishTimes(
    dateStr,
    settings.publishWindowStart || "09:00",
    settings.publishWindowEnd || "17:00",
    count,
    settings.timezone || "America/New_York",
  );

  console.log(`[auto-publisher] starting daily generation run — ${count} article(s), publish times: ${publishTimes.map((d) => d.toISOString()).join(", ")}`);

  // Sequential on purpose: avoids hammering the Anthropic/Shopify APIs at once and
  // avoids two concurrent runs racing for the same untargeted keyword.
  for (let i = 0; i < publishTimes.length; i++) {
    try {
      const result = await generateAndCreateArticle({
        authorId: AUTO_PUBLISHER_AUTHOR_ID,
        tags: [AUTO_PUBLISH_TAG],
        scheduledPublishDate: publishTimes[i],
        logPrefix: "[auto-publisher]",
      });
      console.log(`[auto-publisher] created draft ${i + 1}/${count}: "${result.item.title}" (id ${result.item.id}), scheduled ${publishTimes[i].toISOString()}`);
    } catch (err) {
      console.error(`[auto-publisher] failed to generate article ${i + 1}/${count}:`, (err as Error).message);
      // Keep going — one failed generation shouldn't sink the rest of the day's run.
    }
  }

  console.log("[auto-publisher] daily generation run complete");
}

// ── Publish sweep ────────────────────────────────────────────────────────────

export async function runPublishSweep(): Promise<void> {
  const settings = await getOrCreateAutoPublishSettings();
  if (!settings.enabled) return;

  const now = Date.now();
  const items = await storage.getContentItems(); // merges blog_articles/landing_pages/lead_magnets

  const due = items.filter((item) => {
    if (!item.tags?.includes(AUTO_PUBLISH_TAG)) return false;
    if (item.status === "live") return false;
    if (settings.requireApproval && item.approvalStatus !== "approved") return false;
    if (!item.scheduledPublishDate) return false;
    return new Date(item.scheduledPublishDate).getTime() <= now;
  });

  if (due.length === 0) return;

  console.log(`[auto-publisher] sweep found ${due.length} item(s) due for publish (requireApproval=${settings.requireApproval})`);
  for (const item of due) {
    try {
      await publishContentItemFull(item.id);
      console.log(`[auto-publisher] published "${item.title}" (id ${item.id})`);
    } catch (err) {
      console.error(`[auto-publisher] failed to publish "${item.title}" (id ${item.id}):`, (err as Error).message);
    }
  }
}

// ── Cron wiring ──────────────────────────────────────────────────────────────

function scheduleGenerationTask(settings: AutoPublishSettings) {
  if (generationTask) {
    generationTask.stop();
    generationTask = null;
  }
  if (!settings.enabled) return;

  const [h, m] = (settings.runStartTime || "06:00").split(":").map(Number);
  const expression = `${m} ${h} * * *`;
  generationTask = cron.schedule(expression, () => {
    runDailyGeneration().catch((err) => console.error("[auto-publisher] daily generation run threw:", err));
  }, { timezone: settings.timezone || "America/New_York" });
}

function scheduleSweepTask(settings: AutoPublishSettings) {
  if (sweepTask) {
    sweepTask.stop();
    sweepTask = null;
  }
  if (!settings.enabled) return;

  sweepTask = cron.schedule(SWEEP_CRON_EXPRESSION, () => {
    runPublishSweep().catch((err) => console.error("[auto-publisher] publish sweep threw:", err));
  });
}

/** Call once at server startup. */
export async function initAutoPublisherCron(): Promise<void> {
  const settings = await getOrCreateAutoPublishSettings();
  scheduleGenerationTask(settings);
  scheduleSweepTask(settings);
  console.log(`[auto-publisher] cron initialized — enabled=${settings.enabled}, runStartTime=${settings.runStartTime}, timezone=${settings.timezone}`);
}

/** Call after settings are saved so schedule changes take effect immediately. */
export async function rescheduleAutoPublisherCron(settings: AutoPublishSettings): Promise<void> {
  scheduleGenerationTask(settings);
  scheduleSweepTask(settings);
  console.log(`[auto-publisher] cron rescheduled — enabled=${settings.enabled}, runStartTime=${settings.runStartTime}, timezone=${settings.timezone}`);
}
