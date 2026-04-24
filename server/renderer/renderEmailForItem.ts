/**
 * renderEmailForItem.ts
 * Shared helper: resolves template branding (header/footer/preheader) and
 * Shopify data for a local content item, then delegates to renderEmailToHtml.
 *
 * Extracted to eliminate three-way duplication across email-preview,
 * send-test-email, and push-to-klaviyo routes.
 */

import type { ContentItem } from "@shared/schema";
import { renderEmailToHtml } from "./emailToHtml";
import { getTemplateById, getTemplatesByCategory } from "../services/supabase-templates";

interface EmailRenderResult {
  html: string;
}

interface SupabaseTemplate {
  preheader_text?: string | null;
  email_header?: unknown;
  email_footer?: unknown;
}

async function resolveEmailTemplate(item: ContentItem): Promise<SupabaseTemplate | null> {
  try {
    if (item.templateId) {
      const t = await getTemplateById(String(item.templateId));
      if (t) return t as SupabaseTemplate;
    }
    if (item.type) {
      const fallbacks = await getTemplatesByCategory(item.type);
      if (fallbacks[0]) return fallbacks[0] as SupabaseTemplate;
    }
  } catch {
    // Non-fatal — proceed without template branding
  }
  return null;
}

/** Render a local email content item to a full HTML string. */
export async function renderEmailForItem(item: ContentItem): Promise<EmailRenderResult> {
  const blocks: Array<{ type: string; content: unknown }> = Array.isArray(item.content)
    ? (item.content as Array<{ type: string; content: unknown }>)
    : [];

  const template = await resolveEmailTemplate(item);
  const preheaderText = template?.preheader_text ?? null;
  const emailHeader   = template?.email_header   ?? null;
  const emailFooter   = template?.email_footer   ?? null;

  let shopifyFetcher: Parameters<typeof renderEmailToHtml>[2] = null;
  if (process.env.SHOPIFY_STOREFRONT_TOKEN && process.env.SHOPIFY_STORE_DOMAIN) {
    const { fetchProduct, fetchCollection } = await import("../services/shopify");
    shopifyFetcher = { fetchProduct, fetchCollection };
  }

  const html = await renderEmailToHtml(
    blocks as Parameters<typeof renderEmailToHtml>[0],
    {
      preheaderText,
      header: emailHeader,
      footer: emailFooter,
      title: item.title,
      siteBaseUrl: process.env.SITE_BASE_URL || "https://welltolddesign.com",
    },
    shopifyFetcher,
  );

  return { html };
}
