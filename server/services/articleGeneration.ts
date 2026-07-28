// Shared article-generation core, used by both the manual "AI Quick Create" route
// and the Auto Publisher's scheduled daily run. Keeping this in one place means a
// prompt/pipeline fix (meta description, FAQ links, etc.) only has to happen once.
import { storage } from "../storage";
import {
  generateTitle,
  generateMetaDescription,
  generateWebPageMarkdownContent,
  generateFAQ,
  generateCTAs,
  selectKeywordsForTopic,
  generateKeywordsForTopic,
  generatePhilosophyIntro,
} from "./claude";
import { fetchProductList, fetchProductsByHandles } from "./shopify";
import { matchProductCatalog } from "../config/productCatalog";
import { slugToLabel, withPhilosophyAfterTitle, filterSupportingKeywords } from "../utils/articleHelpers";
import type { ContentItem } from "@shared/schema";

export const AUTO_PUBLISHER_AUTHOR_ID = "auto-publisher";

export class KeywordNotFoundError extends Error {}
export class NoUntargetedKeywordsError extends Error {}

export interface GenerateArticleOptions {
  keywordId?: number;
  topic?: string;
  authorId: string;
  /** Tags stamped onto the created item — the Auto Publisher uses this to find its own items later. */
  tags?: string[] | null;
  scheduledPublishDate?: Date | null;
  /** Log line prefix so it's obvious in server logs whether a run came from the manual button or the scheduler. */
  logPrefix?: string;
}

export interface GenerateArticleResult {
  item: ContentItem;
  keyword: string;
  contentType: string;
  cluster: string | null;
  supportingKeywordsCount: number;
}

type ShopifyProductItem = {
  title: string;
  handle: string;
  price: string;
  imageUrl: string | null;
  variants?: any[];
};

export async function generateAndCreateArticle(opts: GenerateArticleOptions): Promise<GenerateArticleResult> {
  const {
    keywordId: inputKeywordId,
    topic: inputTopic,
    authorId,
    tags = null,
    scheduledPublishDate = null,
    logPrefix = "[generate-article]",
  } = opts;

  // 1. Resolve keyword — three paths: specific keyword, topic seed, or AI auto-pick
  let kw: { id?: number; keyword: string; cluster?: string | null; contentTypeTarget?: string | null; articleAngle?: string | null; type?: string | null; priority?: string | null; volume?: number | null };
  let clusterSupportingKeywords: any[] = [];

  if (inputKeywordId) {
    // Keyword-first: user picked a specific keyword from the library
    const found = await storage.getKeyword(Number(inputKeywordId));
    if (!found) {
      throw new KeywordNotFoundError("Keyword not found.");
    }
    kw = found;
    const allUntargeted = await storage.getKeywords({ status: "untargeted" });
    clusterSupportingKeywords = kw.cluster
      ? allUntargeted.filter((k) => k.cluster === kw.cluster && k.id !== kw.id && k.priority === "supporting")
      : [];
  } else if (inputTopic) {
    // Topic-first: use AI to match the topic against the keyword library.
    // If a match is found, use that keyword (+ its cluster siblings) so the
    // page gets properly linked and the AI gets real SEO keyword context.
    // Falls back to using the topic string directly only if no match found.
    const allKwsForTopic = await storage.getKeywords({});
    const untargetedForTopic = allKwsForTopic.filter((k) => k.status === "untargeted");
    let topicMatched = false;

    if (untargetedForTopic.length > 0) {
      const { primaryKeyword: matchedPrimary, supportingKeywords: matchedSupporting } =
        await selectKeywordsForTopic(inputTopic, untargetedForTopic.map((k) => k.keyword)).catch(() => ({
          primaryKeyword: null,
          supportingKeywords: [],
        }));

      if (matchedPrimary) {
        const primaryKwObj = untargetedForTopic.find(
          (k) => k.keyword.toLowerCase() === matchedPrimary.toLowerCase(),
        );
        if (primaryKwObj) {
          kw = primaryKwObj;
          topicMatched = true;
          // Use AI-selected supporting keywords, then fall back to cluster siblings
          if (matchedSupporting.length > 0) {
            clusterSupportingKeywords = untargetedForTopic.filter(
              (k) =>
                matchedSupporting.some((s) => k.keyword.toLowerCase() === s.toLowerCase()) &&
                k.id !== primaryKwObj.id,
            );
          } else if (primaryKwObj.cluster) {
            clusterSupportingKeywords = untargetedForTopic.filter(
              (k) =>
                k.cluster === primaryKwObj.cluster &&
                k.id !== primaryKwObj.id &&
                k.priority === "supporting",
            );
          }
          console.log(
            `${logPrefix} topic "${inputTopic}" → matched keyword "${kw.keyword}" with ${clusterSupportingKeywords.length} supporting`,
          );
        }
      }
    }

    if (!topicMatched) {
      // No library keyword matched — generate new keywords and add them to the library
      // so this topic gets tracked and the article gets real SEO keyword context.
      console.log(`${logPrefix} topic "${inputTopic}" → no keyword match, generating new keywords`);
      try {
        const generated = await generateKeywordsForTopic(inputTopic);
        console.log(
          `${logPrefix} generated keywords: primary="${generated.primaryKeyword}", cluster="${generated.clusterName}", supporting=${JSON.stringify(generated.supportingKeywords)}`,
        );

        const kwInserts = [
          {
            keyword: generated.primaryKeyword,
            type: "primary" as const,
            priority: "primary" as const,
            cluster: generated.clusterName,
            contentTypeTarget: "blog_article",
            status: "untargeted" as const,
          },
          ...generated.supportingKeywords.map((s) => ({
            keyword: s,
            type: "secondary" as const,
            priority: "supporting" as const,
            cluster: generated.clusterName,
            contentTypeTarget: "blog_article",
            status: "untargeted" as const,
          })),
        ];

        const saved = await storage.createKeywordsBulk(kwInserts);
        const savedPrimary = saved.find((k) => k.priority === "primary") ?? saved[0];
        const savedSupporting = saved.filter((k) => k.id !== savedPrimary.id);

        kw = savedPrimary;
        clusterSupportingKeywords = savedSupporting;
      } catch (genErr) {
        console.warn(`${logPrefix} keyword generation failed, falling back to topic seed:`, (genErr as Error)?.message);
        kw = { keyword: inputTopic, cluster: null, contentTypeTarget: "blog_article", articleAngle: null, type: null };
        clusterSupportingKeywords = [];
      }
    }
  } else {
    // AI Pick: auto-select the best untargeted keyword
    const untargeted = await storage.getKeywords({ status: "untargeted" });
    if (untargeted.length === 0) {
      throw new NoUntargetedKeywordsError("No untargeted keywords found in your library. Add some keywords first.");
    }
    const primaryCandidates = untargeted.filter((k) => k.priority === "primary");
    const pool = primaryCandidates.length > 0 ? primaryCandidates : untargeted;
    const sorted = [...pool].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    kw = sorted[0];
    clusterSupportingKeywords = kw.cluster
      ? untargeted.filter((k) => k.cluster === kw.cluster && k.id !== kw.id && k.priority === "supporting")
      : [];
  }

  // 2. Filter supporting keywords to the most semantically relevant (hard cap: 10)
  const filteredSupporting =
    clusterSupportingKeywords.length > 0
      ? filterSupportingKeywords(
          kw.keyword,
          clusterSupportingKeywords.map((k) => k.keyword),
          8,
          10,
        )
      : [];
  const supportingKeywordsStr =
    filteredSupporting.length > 0 ? filteredSupporting.join(", ") : undefined;
  console.log(
    `${logPrefix} cluster "${kw.cluster}" has ${clusterSupportingKeywords.length} supporting keywords → filtered to ${filteredSupporting.length}: ${filteredSupporting.join(", ")}`,
  );

  // 3. Determine content type
  const contentType = kw.contentTypeTarget || "blog_article";

  // 4. Determine the article title.
  // When the caller supplied a topic/title (topic mode), honour it exactly —
  // never discard or regenerate their own wording.
  // When triggered from the keyword library or AI-pick, generate a title
  // from the keyword as before.
  let title: string;
  if (inputTopic) {
    title = inputTopic;
  } else {
    try {
      title = await generateTitle(kw.keyword, contentType, kw.keyword);
    } catch {
      title = `${kw.keyword.charAt(0).toUpperCase() + kw.keyword.slice(1)}: A Complete Guide`;
    }
  }

  // 5. Load brand context + Shopify products in parallel (both needed before markdown)
  const siteBaseUrl = process.env.SITE_BASE_URL || "https://welltolddesign.com";
  const faqSearchTerm = kw.keyword || title;

  // Check product catalog first — curated handles take priority over keyword search
  const catalogEntryQC = matchProductCatalog(title, kw.keyword);
  const shopifyFetchQC = catalogEntryQC
    ? fetchProductsByHandles(catalogEntryQC.handles).then(items => ({ items })).catch(() => ({ items: [] as ShopifyProductItem[] }))
    : fetchProductList(8, faqSearchTerm).catch((e) => {
        console.error(`${logPrefix} Shopify fetch failed:`, e?.message);
        return { items: [] as ShopifyProductItem[] };
      });

  const [brandContextRaw, shopifyResult] = await Promise.all([
    storage.getBrandContext().catch(() => null),
    shopifyFetchQC,
  ]);

  const brandContext = brandContextRaw
    ? {
        voice_document: brandContextRaw.voiceDocument || undefined,
        always_rules: brandContextRaw.alwaysRules || undefined,
        avoid_rules: brandContextRaw.avoidRules || undefined,
        words_we_use: brandContextRaw.wordsWeUse || undefined,
        words_we_avoid: brandContextRaw.wordsWeAvoid || undefined,
      }
    : undefined;

  const shopifyProducts = (shopifyResult.items as ShopifyProductItem[]).filter((p) => p.imageUrl);
  const allProducts = shopifyProducts.length > 0 ? shopifyProducts : (shopifyResult.items as ShopifyProductItem[]);
  let productContext: string | undefined =
    allProducts.length > 0
      ? allProducts
          .map((p) => {
            const productUrl = `${siteBaseUrl}/products/${p.handle}`;
            const imageLine = p.imageUrl ? ` — image: ${p.imageUrl}` : "";
            const variantTitles = (p.variants ?? []).map((v: any) => v.title).filter((t: string) => t && t !== "Default Title");
            const variantLine = variantTitles.length > 0 ? ` (available in: ${variantTitles.join(", ")})` : "";
            return `- [${p.title}](${productUrl})${variantLine}${imageLine}`;
          })
          .join("\n")
      : undefined;
  // Append catalog-matched collections and pages as supplementary links
  if (catalogEntryQC) {
    const supplementary: string[] = [];
    (catalogEntryQC.collections ?? []).forEach(c =>
      supplementary.push(`- [${slugToLabel(c)}](${siteBaseUrl}/collections/${c})`)
    );
    (catalogEntryQC.pages ?? []).forEach(p =>
      supplementary.push(`- [${slugToLabel(p)}](${siteBaseUrl}/pages/${p})`)
    );
    if (supplementary.length > 0) {
      productContext = (productContext ? productContext + "\n" : "") + supplementary.join("\n");
    }
  }

  // FAQ answers nudge back to a specific product/collection page — reuse the same
  // resolved products (plus any catalog-matched collections/pages) as real link targets.
  const faqProductLinks: Array<{ title: string; url: string }> = [
    ...allProducts.map((p) => ({ title: p.title, url: `${siteBaseUrl}/products/${p.handle}` })),
    ...(catalogEntryQC?.collections ?? []).map((c) => ({ title: slugToLabel(c), url: `${siteBaseUrl}/collections/${c}` })),
  ];

  // 6. Run markdown generation + FAQ + CTAs + philosophy intro all in parallel
  const [markdown, faqItems, ctaData, philosophyIntro] = await Promise.all([
    generateWebPageMarkdownContent({
      title,
      type: contentType,
      primaryKeyword: kw.keyword,
      supportingKeywords: supportingKeywordsStr,
      articleAngle: kw.articleAngle || undefined,
      keywordType: kw.type || undefined,
      mood: "conversational",
      productContext,
      siteBaseUrl,
      brandContext,
    }),
    generateFAQ(faqSearchTerm, supportingKeywordsStr, faqProductLinks).catch((e) => {
      console.error(`${logPrefix} FAQ generation failed:`, e?.message);
      return [];
    }),
    generateCTAs(faqSearchTerm, siteBaseUrl).catch((e) => {
      console.error(`${logPrefix} CTA generation failed:`, e?.message);
      return null;
    }),
    generatePhilosophyIntro(kw.keyword, title, brandContext).catch((e) => {
      console.error(`${logPrefix} Philosophy intro failed:`, e?.message);
      return "";
    }),
  ]);
  console.log(
    `${logPrefix} FAQ: ${faqItems.length} items, CTA: ${!!ctaData}, Products: ${shopifyResult.items.length}`,
  );

  // 6b. Generate meta description (non-fatal — article still saves if this fails)
  const metaDescription = await generateMetaDescription(
    title,
    contentType,
    kw.keyword,
    supportingKeywordsStr,
  ).catch((e) => {
    console.error(`${logPrefix} meta description generation failed:`, e?.message);
    return null;
  });

  // 7b. Build structured data (Article JSON-LD + private _wt_ render keys)
  const now = new Date().toISOString();
  const structuredData: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    datePublished: now,
    dateModified: now,
    publisher: {
      "@type": "Organization",
      name: "Well Told Design",
      url: siteBaseUrl,
    },
    ...(kw.keyword
      ? {
          keywords: kw.keyword + (supportingKeywordsStr ? ", " + supportingKeywordsStr : ""),
        }
      : {}),
  };

  if (faqItems.length > 0) {
    structuredData["_wt_faq"] = faqItems;
  }
  if (shopifyProducts.length > 0) {
    structuredData["_wt_products"] = shopifyProducts.slice(0, 4).map((p) => ({
      title: p.title,
      handle: p.handle,
      imageUrl: p.imageUrl,
      price: p.price,
      url: `${siteBaseUrl}/products/${p.handle}`,
    }));
  }
  if (ctaData) {
    structuredData["_wt_cta"] = ctaData;
  }

  // 7c. Build slug from title
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  const finalSlug = await storage.generateUniqueSlug(baseSlug, contentType);

  // FAQ lives only in _wt_faq structured data — rendered as accordion by the worker.
  // 8. Create the content item — store markdown, structured data (FAQ/products/CTAs), and keywords
  const newItem = await storage.createContentItem({
    title,
    slug: finalSlug,
    type: contentType,
    status: "draft",
    approvalStatus: "pending",
    primaryKeyword: kw.keyword,
    supportingKeywords: supportingKeywordsStr || null,
    markdownContent: withPhilosophyAfterTitle(philosophyIntro, markdown),
    structuredData: Object.keys(structuredData).length > 0 ? structuredData : null,
    metaDescription,
    tags,
    scheduledPublishDate,
    authorId,
  } as any);

  const contentItemId = String(newItem.id);

  // 9. Link keyword statuses only when a real keyword was used (not topic-only)
  const filteredSupportingObjects = clusterSupportingKeywords.filter((sk) =>
    filteredSupporting.includes(sk.keyword),
  );
  if (kw.id) {
    await storage.updateKeyword(kw.id, {
      status: "in_progress",
      contentItemId,
    });
    if (filteredSupportingObjects.length > 0) {
      await Promise.all(
        filteredSupportingObjects.map((sk) =>
          storage.updateKeyword(sk.id, {
            status: "in_progress",
            contentItemId,
          }),
        ),
      );
    }
    console.log(
      `${logPrefix} linked ${filteredSupportingObjects.length} supporting keywords (of ${clusterSupportingKeywords.length} in cluster) to article ${contentItemId}`,
    );
  }

  // Fire-and-forget: generate hero image in background after returning
  if (!newItem.featuredImage) {
    (async () => {
      try {
        const { generateImage } = await import("./imageGeneration");
        const topic = newItem.primaryKeyword || title;
        const result = await generateImage({
          mode: "ai-prompt",
          topic,
          keyword: newItem.primaryKeyword ?? undefined,
          brandContext: {
            voice: "Well Told Design — a gift brand specialising in story-driven objects: map glassware, constellation gifts, topographic drinkware, and throws. Warm photography, real places, physical objects with meaning.",
          },
        });
        await storage.updateContentItem(newItem.id, {
          featuredImage: result.cloudinaryUrl,
          ...(!newItem.ogImage ? { ogImage: result.cloudinaryUrl } : {}),
        });
        console.log(`${logPrefix} background hero image generated for ${newItem.id}: ${result.cloudinaryUrl}`);
      } catch (err) {
        console.error(`${logPrefix} background hero image failed for ${newItem.id}:`, err);
      }
    })();
  }

  return {
    item: newItem,
    keyword: kw.keyword,
    contentType,
    cluster: kw.cluster || null,
    supportingKeywordsCount: filteredSupportingObjects.length,
  };
}
