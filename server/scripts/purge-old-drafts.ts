/**
 * Review, then remove, article drafts written by the old generator.
 *
 * Every blog draft created before the reworked generator went live (CUTOFF) was
 * written with the single repeated template, unscoped keywords and the markup bug.
 * The valuable part of each one is its keyword, not its text, so deleting a draft
 * releases its keyword back to "untargeted" and the new pipeline rewrites it
 * properly (skipping any keyword a live article already covers).
 *
 * Groups:
 *   DELETE  old-generator drafts nobody has touched since creation
 *   REVIEW  old-generator drafts edited 2h+ after creation (possibly hand-edited) — kept unless --include-edited
 *   RETIRED drafts retired by the duplicate merge (their URLs redirect) — kept unless --include-retired
 *   KEEP    drafts from the new generator
 * Landing pages, lead magnets and emails are listed for information only and never touched.
 *
 * --apply writes a full JSON backup of every row it deletes (drafts-backup-<time>.json,
 * gitignored) before deleting anything.
 *
 * Run with:
 *   npx tsx server/scripts/purge-old-drafts.ts                      # dry run: lists everything, changes nothing
 *   npx tsx server/scripts/purge-old-drafts.ts --apply              # delete the DELETE group
 *   npx tsx server/scripts/purge-old-drafts.ts --apply --include-edited --include-retired
 */

import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { locationTargets } from "@shared/schema";
import { storage } from "../storage";

// When the reworked generator went live in production (the 2026-10-22 republish).
const CUTOFF = new Date(process.argv.find((a) => a.startsWith("--before="))?.slice(9) || "2026-10-22T09:33:46Z");
const APPLY = process.argv.includes("--apply");
const INCLUDE_EDITED = process.argv.includes("--include-edited");
const INCLUDE_RETIRED = process.argv.includes("--include-retired");
const EDIT_GAP_MS = 2 * 60 * 60 * 1000;

type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  focus_keyword: string | null;
  created_at: string;
  updated_at: string | null;
  redirect_from: unknown;
};

function normalizeSlug(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/^https?:\/\/[^/]+/, "").replace(/^\/+|\/+$/g, "").replace(/^a\/articles\//, "");
}

function redirectList(value: unknown): string[] {
  let list = value;
  if (typeof value === "string") {
    try { list = JSON.parse(value); } catch { list = value.replace(/^\{|\}$/g, "").split(","); }
  }
  return Array.isArray(list) ? list.map(normalizeSlug).filter(Boolean) : [];
}

function line(r: Row): string {
  const created = (r.created_at || "").slice(0, 10);
  const title = r.title.length > 70 ? `${r.title.slice(0, 67)}...` : r.title;
  return `  ${created}  ${r.status.padEnd(9)} ${title}${r.focus_keyword ? `  [${r.focus_keyword}]` : ""}`;
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  );

  const cols = "id, slug, title, status, focus_keyword, created_at, updated_at, redirect_from";
  const [blogs, landings, leads] = await Promise.all(
    ["blog_articles", "landing_pages", "lead_magnets"].map((t) => supabase.from(t).select(cols)),
  );
  for (const r of [blogs, landings, leads]) if (r.error) throw new Error(r.error.message);

  const all = [...(blogs.data ?? []), ...(landings.data ?? []), ...(leads.data ?? [])] as Row[];
  const retiredSlugs = new Set(all.filter((r) => r.status === "live").flatMap((r) => redirectList(r.redirect_from)));

  const blogDrafts = ((blogs.data ?? []) as Row[]).filter((r) => r.status !== "live");
  const groups = { DELETE: [] as Row[], REVIEW: [] as Row[], RETIRED: [] as Row[], KEEP: [] as Row[] };
  for (const r of blogDrafts) {
    const created = new Date(r.created_at);
    const edited = r.updated_at ? new Date(r.updated_at).getTime() - created.getTime() > EDIT_GAP_MS : false;
    if (retiredSlugs.has(normalizeSlug(r.slug))) groups.RETIRED.push(r);
    else if (created >= CUTOFF) groups.KEEP.push(r);
    else if (edited) groups.REVIEW.push(r);
    else groups.DELETE.push(r);
  }
  for (const g of Object.values(groups)) g.sort((a, b) => a.created_at.localeCompare(b.created_at));

  console.log(`Generator cutoff: ${CUTOFF.toISOString()}   Live blog articles: ${((blogs.data ?? []) as Row[]).filter((r) => r.status === "live").length}\n`);
  const describe: Record<keyof typeof groups, string> = {
    DELETE: "old generator, untouched since creation — will be deleted",
    REVIEW: `old generator but edited 2h+ after creation — kept${INCLUDE_EDITED ? " (OVERRIDDEN: will be deleted)" : ""}`,
    RETIRED: `retired by the duplicate merge, URL redirects — kept${INCLUDE_RETIRED ? " (OVERRIDDEN: will be deleted)" : ""}`,
    KEEP: "written by the new generator — kept",
  };
  for (const [name, rows] of Object.entries(groups) as Array<[keyof typeof groups, Row[]]>) {
    console.log(`${name} (${rows.length}): ${describe[name]}`);
    rows.forEach((r) => console.log(line(r)));
    console.log("");
  }
  const otherDrafts = [...((landings.data ?? []) as Row[]), ...((leads.data ?? []) as Row[])].filter((r) => r.status !== "live");
  console.log(`Landing pages / lead magnets not live (${otherDrafts.length}) — listed only, never touched:`);
  otherDrafts.forEach((r) => console.log(line(r)));

  const toDelete = [
    ...groups.DELETE,
    ...(INCLUDE_EDITED ? groups.REVIEW : []),
    ...(INCLUDE_RETIRED ? groups.RETIRED : []),
  ];

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing changed. ${toDelete.length} draft(s) would be deleted. Re-run with --apply to delete them.`);
    return;
  }
  if (toDelete.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  // Full backup first, so any deletion can be restored by hand.
  const ids = toDelete.map((r) => r.id);
  const { data: fullRows, error: backupErr } = await supabase.from("blog_articles").select("*").in("id", ids);
  if (backupErr) throw new Error(`Backup read failed, nothing deleted: ${backupErr.message}`);
  const backupFile = `drafts-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(backupFile, JSON.stringify(fullRows, null, 2));
  console.log(`\nBacked up ${fullRows?.length ?? 0} row(s) to ${backupFile}`);

  let deleted = 0;
  let releasedKeywords = 0;
  for (const r of toDelete) {
    const { error } = await supabase.from("blog_articles").delete().eq("id", r.id).neq("status", "live");
    if (error) {
      console.log(`  ! failed to delete "${r.title}": ${error.message}`);
      continue;
    }
    deleted++;
    releasedKeywords += await storage.releaseKeywordsByContentItemId(String(r.id));
    await db
      .update(locationTargets)
      .set({ status: "untargeted", contentItemId: null })
      .where(eq(locationTargets.contentItemId, String(r.id)));
  }
  console.log(`Deleted ${deleted} draft(s); released ${releasedKeywords} keyword link(s) back to the library.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
