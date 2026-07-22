/**
 * Centralised Klaviyo API service — fully typed.
 * Reads credentials from the integrations table (type = "klaviyo").
 */

import { db } from "../db";
import { integrations } from "@shared/schema";
import { eq } from "drizzle-orm";

const API_BASE = "https://a.klaviyo.com/api";
const REVISION  = "2024-02-15";

// Klaviyo's template deep-link URL changed — the old /email-editor/templates/{id} 404s.
// Send users to the templates list where the newly pushed template appears at the top.
const KLAVIYO_TEMPLATES_URL = "https://www.klaviyo.com/content/templates";

export class KlaviyoNotConnectedError extends Error {
  readonly code = "klaviyo_required";
  constructor() {
    super("klaviyo_required");
    this.name = "KlaviyoNotConnectedError";
  }
}

// Typed Klaviyo JSON:API response shapes

interface KlaviyoApiError {
  errors?: Array<{ detail?: string }>;
}

interface KlaviyoTemplateData {
  id: string;
  attributes?: {
    name?: string;
    updated?: string;
  };
}

interface KlaviyoCreateTemplateResponse {
  data?: { id?: string };
}

interface KlaviyoListData {
  id: string;
  attributes?: {
    name?: string;
  };
}

/**
 * Follow Klaviyo's JSON:API cursor pagination (links.next) to collect every page.
 * Klaviyo caps page[size] at 10 on list-style endpoints, so a single page is rarely complete.
 */
async function fetchAllPages<T>(
  firstUrl: string,
  headers: Record<string, string>,
  context: string,
): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = firstUrl;
  while (url) {
    const res: Response = await fetch(url, { headers });
    await assertOk(res, context);
    const json: { data?: T[]; links?: { next?: string | null } } = await res.json();
    results.push(...(json.data ?? []));
    url = json.links?.next ?? null;
  }
  return results;
}

async function getApiKey(): Promise<string> {
  const rows = await db.select()
    .from(integrations)
    .where(eq(integrations.type, "klaviyo"))
    .limit(1);

  const klaviyo = rows[0];
  if (!klaviyo || klaviyo.status !== "connected") {
    throw new KlaviyoNotConnectedError();
  }

  const creds = klaviyo.credentials as { apiKey?: string };
  if (!creds?.apiKey) throw new Error("Klaviyo API key not found in stored credentials.");
  return creds.apiKey;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    "Authorization":  `Klaviyo-API-Key ${apiKey}`,
    "Content-Type":   "application/vnd.api+json",
    "revision":       REVISION,
  };
}

async function assertOk(res: Response, context: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  let detail = "";
  try {
    const parsed: KlaviyoApiError = JSON.parse(body);
    detail = parsed.errors?.[0]?.detail ?? body;
  } catch {
    detail = body;
  }
  throw new Error(`Klaviyo ${context} returned ${res.status}: ${detail}`);
}

/**
 * Send a test/preview email via SMTP (nodemailer).
 * Klaviyo's v3 JSON:API has no standalone send-email endpoint;
 * SMTP is the correct mechanism for ad-hoc test sends.
 *
 * Required env vars: SMTP_HOST, SMTP_USER, SMTP_PASS
 * Optional:          SMTP_PORT (default 587), SMTP_FROM
 */
export async function sendTestEmail(html: string, toEmail: string, subject: string): Promise<void> {
  const { sendEmail } = await import("./email");
  await sendEmail({ to: toEmail, subject, html });
}

export interface KlaviyoTemplateResult {
  id: string;
  url: string;
}

/**
 * Create a new Klaviyo template, or update an existing one in-place when
 * `existingTemplateId` is supplied.
 * If the stored template was deleted in Klaviyo (404/410), falls back to creating a new one.
 * Returns the templates list URL — Klaviyo's per-template deep-link is unreliable.
 */
export async function pushTemplate(
  name: string,
  html: string,
  existingTemplateId?: string | null,
): Promise<KlaviyoTemplateResult> {
  const apiKey = await getApiKey();

  if (existingTemplateId) {
    const patchRes = await fetch(`${API_BASE}/templates/${existingTemplateId}/`, {
      method: "PATCH",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        data: {
          type: "template",
          id: existingTemplateId,
          attributes: { name, html },
        },
      }),
    });

    // If deleted/archived in Klaviyo, fall through to create a fresh template
    if (patchRes.status !== 404 && patchRes.status !== 410) {
      await assertOk(patchRes, "update-template");
      return {
        id: existingTemplateId,
        url: KLAVIYO_TEMPLATES_URL,
      };
    }
  }

  const res = await fetch(`${API_BASE}/templates/`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      data: {
        type: "template",
        attributes: { name, editor_type: "CODE", html },
      },
    }),
  });
  await assertOk(res, "create-template");
  const json: KlaviyoCreateTemplateResponse = await res.json();
  const id = json?.data?.id;
  if (!id) throw new Error("Klaviyo did not return a template ID.");
  return {
    id,
    url: KLAVIYO_TEMPLATES_URL,
  };
}

export interface KlaviyoTemplate {
  id: string;
  name: string;
  updatedAt: string;
}

/** List all Klaviyo email templates (paginated — Klaviyo caps page[size] at 10 for this endpoint). */
export async function listTemplates(): Promise<KlaviyoTemplate[]> {
  const apiKey = await getApiKey();
  const data = await fetchAllPages<KlaviyoTemplateData>(
    `${API_BASE}/templates/?page[size]=10`,
    buildHeaders(apiKey),
    "list-templates",
  );
  return data.map((t) => ({
    id:        t.id,
    name:      t.attributes?.name      ?? "",
    updatedAt: t.attributes?.updated   ?? "",
  }));
}

export interface KlaviyoList {
  id: string;
  name: string;
}

/** List all Klaviyo lists (paginated — Klaviyo caps page[size] at 10 for this endpoint). */
export async function listLists(): Promise<KlaviyoList[]> {
  const apiKey = await getApiKey();
  const data = await fetchAllPages<KlaviyoListData>(
    `${API_BASE}/lists/?page[size]=10`,
    buildHeaders(apiKey),
    "list-lists",
  );
  return data.map((l) => ({
    id:   l.id,
    name: l.attributes?.name ?? "",
  }));
}

/** List all Klaviyo segments (paginated — Klaviyo caps page[size] at 10 for this endpoint). */
export async function listSegments(): Promise<KlaviyoList[]> {
  const apiKey = await getApiKey();
  const data = await fetchAllPages<KlaviyoListData>(
    `${API_BASE}/segments/?page[size]=10`,
    buildHeaders(apiKey),
    "list-segments",
  );
  return data.map((s) => ({
    id:   s.id,
    name: s.attributes?.name ?? "",
  }));
}

export interface KlaviyoAudience extends KlaviyoList {
  kind: "list" | "segment";
}

/** List both Klaviyo lists and segments — for use in campaign audience selection. */
export async function listAudiences(): Promise<KlaviyoAudience[]> {
  const [lists, segments] = await Promise.all([listLists(), listSegments()]);
  return [
    ...lists.map((l): KlaviyoAudience => ({ ...l, kind: "list" })),
    ...segments.map((s): KlaviyoAudience => ({ ...s, kind: "segment" })),
  ];
}

export interface KlaviyoCampaignResult {
  id: string;
  url: string;
}

export interface CreateCampaignOptions {
  name: string;
  subject: string;
  previewText: string;
  fromEmail: string;
  fromLabel: string;
  audienceId: string;
  audienceType: "list" | "segment";
  html: string;
}

interface KlaviyoCampaignResponse {
  data?: { id?: string };
}

interface KlaviyoCampaignMessagesResponse {
  data?: Array<{ id?: string }>;
}

/**
 * Create a new Klaviyo Campaign (draft) with the supplied HTML content.
 * Flow: create campaign → fetch auto-created message → patch message with HTML + subject.
 */
export async function createCampaign(opts: CreateCampaignOptions): Promise<KlaviyoCampaignResult> {
  const apiKey = await getApiKey();
  const headers = buildHeaders(apiKey);

  // 1. Create the campaign (draft — no send triggered)
  const createRes = await fetch(`${API_BASE}/campaigns/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        type: "campaign",
        attributes: {
          name: opts.name,
          audiences: {
            included: [opts.audienceId],
          },
          "campaign-messages": {
            data: [
              {
                type: "campaign-message",
                attributes: {
                  channel: "email",
                  label: opts.name,
                },
              },
            ],
          },
        },
      },
    }),
  });
  await assertOk(createRes, "create-campaign");
  const campaignJson: KlaviyoCampaignResponse = await createRes.json();
  const campaignId = campaignJson?.data?.id;
  if (!campaignId) throw new Error("Klaviyo did not return a campaign ID.");

  // 2. Fetch the auto-created campaign message
  const msgListRes = await fetch(`${API_BASE}/campaigns/${campaignId}/campaign-messages/`, {
    headers,
  });
  await assertOk(msgListRes, "list-campaign-messages");
  const msgListJson: KlaviyoCampaignMessagesResponse = await msgListRes.json();
  const messageId = msgListJson?.data?.[0]?.id;
  if (!messageId) throw new Error("Klaviyo did not return a campaign message ID.");

  // 3. The rendered HTML has to go through a Template, not campaign-message content —
  // "content" only holds text fields (subject, preview_text, from info); the actual
  // markup is assigned via a separate template relationship.
  const template = await pushTemplate(opts.name, opts.html);
  const assignRes = await fetch(`${API_BASE}/campaign-message-assign-template/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        type: "campaign-message",
        id: messageId,
        relationships: {
          template: {
            data: { type: "template", id: template.id },
          },
        },
      },
    }),
  });
  await assertOk(assignRes, "assign-template-to-campaign-message");

  // 4. Update the message with subject and from info (text fields only — no HTML here)
  const patchRes = await fetch(`${API_BASE}/campaign-messages/${messageId}/`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      data: {
        type: "campaign-message",
        id: messageId,
        attributes: {
          label: opts.name,
          content: {
            subject: opts.subject,
            preview_text: opts.previewText,
            from_email: opts.fromEmail,
            from_label: opts.fromLabel,
          },
        },
      },
    }),
  });
  await assertOk(patchRes, "update-campaign-message");

  return {
    id: campaignId,
    url: `https://www.klaviyo.com/campaigns/${campaignId}/`,
  };
}
