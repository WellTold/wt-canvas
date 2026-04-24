/**
 * Centralised Klaviyo API service — fully typed.
 * Reads credentials from the integrations table (type = "klaviyo").
 */

import { db } from "../db";
import { integrations } from "@shared/schema";
import { eq } from "drizzle-orm";

const API_BASE = "https://a.klaviyo.com/api";
const REVISION  = "2024-02-15";

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

interface KlaviyoTemplatesResponse {
  data?: KlaviyoTemplateData[];
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

interface KlaviyoListsResponse {
  data?: KlaviyoListData[];
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

/** Send a transactional test email via Klaviyo's Messages API. */
export async function sendTestEmail(html: string, toEmail: string, subject: string): Promise<void> {
  const apiKey = await getApiKey();
  const res = await fetch(`${API_BASE}/messages/send-email/`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      data: {
        type: "email-message",
        attributes: {
          body: { html },
          from_email: "hello@welltolddesign.com",
          from_label: "Well Told",
          subject,
          to: [toEmail],
        },
      },
    }),
  });
  await assertOk(res, "send-email");
}

export interface KlaviyoTemplateResult {
  id: string;
  url: string;
}

/**
 * Create a new Klaviyo template, or update an existing one in-place when
 * `existingTemplateId` is supplied.
 * If the stored template was deleted in Klaviyo (404/410), falls back to creating a new one.
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
          attributes: { name, editor_type: "CODE", html },
        },
      }),
    });

    // If deleted/archived in Klaviyo, fall through to create a fresh template
    if (patchRes.status !== 404 && patchRes.status !== 410) {
      await assertOk(patchRes, "update-template");
      return {
        id: existingTemplateId,
        url: `https://www.klaviyo.com/email-editor/templates/${existingTemplateId}`,
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
    url: `https://www.klaviyo.com/email-editor/templates/${id}`,
  };
}

export interface KlaviyoTemplate {
  id: string;
  name: string;
  updatedAt: string;
}

/** List Klaviyo email templates (latest 50). */
export async function listTemplates(): Promise<KlaviyoTemplate[]> {
  const apiKey = await getApiKey();
  const res = await fetch(`${API_BASE}/templates/?page[size]=50`, {
    headers: buildHeaders(apiKey),
  });
  await assertOk(res, "list-templates");
  const json: KlaviyoTemplatesResponse = await res.json();
  return (json.data ?? []).map((t) => ({
    id:        t.id,
    name:      t.attributes?.name      ?? "",
    updatedAt: t.attributes?.updated   ?? "",
  }));
}

export interface KlaviyoList {
  id: string;
  name: string;
}

/** List Klaviyo lists (latest 50). */
export async function listLists(): Promise<KlaviyoList[]> {
  const apiKey = await getApiKey();
  const res = await fetch(`${API_BASE}/lists/?page[size]=50`, {
    headers: buildHeaders(apiKey),
  });
  await assertOk(res, "list-lists");
  const json: KlaviyoListsResponse = await res.json();
  return (json.data ?? []).map((l) => ({
    id:   l.id,
    name: l.attributes?.name ?? "",
  }));
}

/** List Klaviyo segments (latest 50). */
export async function listSegments(): Promise<KlaviyoList[]> {
  const apiKey = await getApiKey();
  const res = await fetch(`${API_BASE}/segments/?page[size]=50`, {
    headers: buildHeaders(apiKey),
  });
  await assertOk(res, "list-segments");
  const json: KlaviyoListsResponse = await res.json();
  return (json.data ?? []).map((s) => ({
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
            included: [{ id: opts.audienceId, type: opts.audienceType }],
          },
          send_strategy: { method: "static" },
          channel: "email",
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

  // 3. Update the message with subject, from info, and rendered HTML
  const patchRes = await fetch(`${API_BASE}/campaign-messages/${messageId}/`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      data: {
        type: "campaign-message",
        id: messageId,
        attributes: {
          label: opts.name,
          channel: "email",
          content: {
            subject: opts.subject,
            from_email: opts.fromEmail,
            from_label: opts.fromLabel,
            html_body: opts.html,
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
