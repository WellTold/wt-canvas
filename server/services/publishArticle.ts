// Shared publish core, used by both the manual "Publish" button
// (POST /api/publish/supabase) and the Auto Publisher's scheduled sweep.
import { createClient } from "@supabase/supabase-js";
import { storage } from "../storage";
import { generateWebPageMarkdown } from "./claude";
import { supabaseLegacyPublisher } from "./supabase-legacy";
import type { ContentItem } from "@shared/schema";

const supabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const WEBPAGE_TABLE_MAP: Record<string, string> = {
  blog_article: "blog_articles",
  landing_page: "landing_pages",
  lead_magnet: "lead_magnets",
  blog: "blog_articles",
  landing: "landing_pages",
};

export interface PublishResult {
  success: boolean;
  id: string;
  message: string;
  url: string;
}

/**
 * Syncs the latest draft content to Supabase, flips status to live, purges the
 * Cloudflare edge cache, and marks any linked keywords as published. Does NOT
 * check approvalStatus — that gate belongs to the caller (the auto-publish sweep
 * only selects approved items; the manual Publish button has always allowed
 * publishing regardless of approval state, and this preserves that).
 */
export async function publishContentItemFull(
  contentId: string | number,
  passedFeaturedImage?: string | null,
): Promise<PublishResult> {
  console.log("📤 Publishing to Supabase:", { contentId, passedFeaturedImage: passedFeaturedImage ?? "(not passed)" });

  const contentItem = await storage.getContentItem(contentId);
  if (!contentItem) {
    throw new Error("Content item not found");
  }

  // Ensure content_markdown is present before publishing so the Cloudflare Worker
  // can consume it. Fetch content_json directly from Supabase (bypassing the
  // storage abstraction which returns content_markdown as a string when set).
  const publishTableName = WEBPAGE_TABLE_MAP[contentItem.contentType || contentItem.type];
  if (publishTableName) {
    // Build a sync payload: always push the latest content_markdown + structured_data
    // from Canvas to Supabase so the Cloudflare Worker renders the most current version.
    const syncData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (contentItem.markdownContent) {
      syncData.content_markdown = contentItem.markdownContent;
    }
    if (contentItem.structuredData) {
      syncData.structured_data = contentItem.structuredData;
    }
    // Use the featuredImage passed from the editor as priority (covers the case where
    // the user set an image but hasn't saved yet), falling back to what's in the DB.
    const effectiveFeaturedImage = passedFeaturedImage || contentItem.featuredImage || null;
    if (effectiveFeaturedImage) {
      syncData.featured_image = effectiveFeaturedImage;
    }
    if ((contentItem as any).ogImage) {
      syncData.og_image = (contentItem as any).ogImage;
    }
    if ((contentItem as any).ogTitle) {
      syncData.og_title = (contentItem as any).ogTitle;
    }
    if ((contentItem as any).metaDescription) {
      syncData.meta_description = (contentItem as any).metaDescription;
    }

    // For legacy block-only pages: auto-generate markdown if none exists anywhere
    if (!contentItem.markdownContent) {
      const { data: publishRow } = await supabaseClient
        .from(publishTableName)
        .select("content_json, content_markdown")
        .eq("id", contentId)
        .single();
      if (
        publishRow &&
        !publishRow.content_markdown &&
        Array.isArray(publishRow.content_json) &&
        publishRow.content_json.length > 0
      ) {
        syncData.content_markdown = generateWebPageMarkdown(
          publishRow.content_json,
          contentItem.title,
        );
        console.log(`✅ Auto-generated content_markdown for legacy block page ${contentId}`);
      }
    }

    if (Object.keys(syncData).length > 1) {
      console.log(`📦 Sync payload for ${contentId}:`, Object.keys(syncData), "featured_image:", syncData.featured_image ?? "(not set)");
      await supabaseClient
        .from(publishTableName)
        .update(syncData)
        .eq("id", contentId);
      console.log(`✅ Synced content to Supabase for ${contentId} before publish`);
    }
  }

  const result = await supabaseLegacyPublisher.publish(contentItem);

  // Purge Cloudflare edge cache so the updated HTML (with hero image, SEO fields, etc.)
  // is served immediately rather than stale cached content
  if (contentItem.slug && process.env.CF_ZONE_ID && process.env.CF_API_TOKEN) {
    const baseUrl = process.env.SITE_BASE_URL || "https://welltolddesign.com";
    const purgeUrls = [
      `${baseUrl}/a/articles/${contentItem.slug}`,
      `${baseUrl}/articles/${contentItem.slug}`,
      `${baseUrl}/a/pages/${contentItem.slug}`,
      `${baseUrl}/pages/${contentItem.slug}`,
    ];
    console.log(`Purging CF cache after publish: ${purgeUrls.join(", ")}`);
    try {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ files: purgeUrls }),
        },
      );
      if (cfRes.ok) {
        console.log(`✅ CF cache purged after publish: ${purgeUrls.join(", ")}`);
      } else {
        const errText = await cfRes.text();
        console.warn(`⚠️ CF cache purge failed (${cfRes.status}): ${errText}`);
      }
    } catch (purgeErr) {
      console.warn("⚠️ CF cache purge error (non-fatal):", purgeErr);
    }
  }

  // Publish lifecycle: auto-flip all linked keyword statuses to published
  try {
    const linkedKws = await storage.getKeywordsByContentItemId(String(contentItem.id));
    for (const kw of linkedKws) {
      if (kw.status !== "published") {
        await storage.updateKeyword(kw.id, { status: "published" });
      }
    }
  } catch {
    // Non-fatal — don't fail the publish if keyword sync fails
  }

  return result;
}
