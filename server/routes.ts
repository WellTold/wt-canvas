import type { Express } from "express";
import { createServer, type Server } from "http";
import { createClient } from '@supabase/supabase-js';
import { storage } from "./storage";
import { seedUsers } from "./services/auth";
import { insertContentItemSchema, insertContentBlockSchema, blockPresets, siteSettings, integrations, insertIntegrationSchema, emailStyles, insertEmailStyleSchema, insertKeywordSchema } from "@shared/schema";
import { z } from "zod";
import { improveContent, refineContent, generateTitle, generateMetaDescription, generateSection, suggestKeywords, generateCompleteArticle, generateWebPageMarkdown } from "./services/claude";
import { fetchProductList, isShopifyConfigured } from "./services/shopify";
import { supabaseLegacyPublisher } from "./services/supabase-legacy";
import { markdownToHtml } from "./utils/markdown";
import { COMPONENT_REGISTRY } from "./config/componentRegistry";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

const supabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

async function resolveImageSuggestions(params: {
  description?: string;
  title?: string;
  keyword?: string;
}): Promise<Array<{ url: string; displayName: string; publicId: string; source: string; folder: string | null }>> {
  const { description, title, keyword } = params;
  const searchTerms = [description, keyword, title].filter(Boolean).join(" ").trim();
  if (!searchTerms) return [];

  const shopifyQuery = [keyword, title].filter(Boolean).join(" ").trim() || description || "";

  // Run Cloudinary and Shopify fetches concurrently to minimise latency
  const [cloudinaryResult, shopifyResult] = await Promise.allSettled([
    (async () => {
      const { searchCloudinaryAssets } = await import("./services/cloudinary");
      return searchCloudinaryAssets(searchTerms, 'image', 10);
    })(),
    (async () => {
      if (!shopifyQuery) return [];
      const result = await fetchProductList(5, shopifyQuery);
      return result.items.filter(p => p.imageUrl);
    })(),
  ]);

  const suggestions: Array<{ url: string; displayName: string; publicId: string; source: string; folder: string | null }> = [];

  if (cloudinaryResult.status === 'fulfilled') {
    cloudinaryResult.value.slice(0, 3).forEach(asset => {
      suggestions.push({
        url: asset.secure_url,
        displayName: asset.display_name,
        publicId: asset.public_id,
        source: 'cloudinary',
        folder: asset.folder || null,
      });
    });
  } else {
    console.warn('Cloudinary image suggest failed:', cloudinaryResult.reason?.message);
  }

  if (shopifyResult.status === 'fulfilled') {
    (shopifyResult.value as any[]).slice(0, 2).forEach(p => {
      suggestions.push({
        url: p.imageUrl,
        displayName: p.title,
        publicId: p.handle,
        source: 'shopify',
        folder: null,
      });
    });
  }
  // Shopify silently skipped if not configured

  return suggestions;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed initial users in Supabase Auth
  await seedUsers();

  // Public config endpoint — returns safe-to-expose Supabase credentials for frontend client
  app.get("/api/public-config", (_req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      shopifyConfigured: !!(process.env.SHOPIFY_STOREFRONT_TOKEN && process.env.SHOPIFY_STORE_DOMAIN),
    });
  });

  // Component registry — public read, no auth required
  app.get("/api/components", (_req, res) => {
    res.json(COMPONENT_REGISTRY);
  });

  // App Block loader script — mirrors worker /components/loader.js
  // Injected into server-rendered previews whenever a page contains app_blocks.
  app.get("/components/loader.js", (_req, res) => {
    const js = `(function(){
  function init(){
    document.querySelectorAll('[data-wt-component]').forEach(function(el){
      if(el.__wtInit)return;
      el.__wtInit=true;
      var name=el.getAttribute('data-wt-component');
      var cfg={};
      try{cfg=JSON.parse(el.getAttribute('data-wt-config')||'{}');}catch(_){}
      var ns=window.__WTC_INIT=window.__WTC_INIT||{};
      if(typeof ns[name]==='function'){
        try{ns[name](el,cfg);}catch(e){console.error('[wt-component] '+name+':',e);}
      }else{delete el.__wtInit;}
    });
  }
  window.__WTC_RUN=init;
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}
  else{init();}
})();`;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(js);
  });

  // Auth middleware — validates Supabase Bearer token
  const requireAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.substring(7);

    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      req.userId = user.id;
      req.user = user;
      return next();
    } catch {
      return res.status(401).json({ message: "Authentication required" });
    }
  };

  // Auth routes
  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const metadata = user.user_metadata || {};
    res.json({
      id: user.id,
      email: user.email,
      name: metadata.name || user.email,
      initials: metadata.initials || (user.email || '').substring(0, 2).toUpperCase(),
      firstName: metadata.firstName || null,
      lastName: metadata.lastName || null,
      displayName: metadata.displayName || null,
      avatarUrl: metadata.avatarUrl || null,
      defaultTheme: metadata.defaultTheme || 'light',
      backgroundColor: metadata.backgroundColor || '#f0ebe7',
      role: metadata.role || 'editor',
    });
  });

  // Content Items routes
  app.get("/api/content-items", requireAuth, async (req, res) => {
    try {
      const { type } = req.query;
      const items = await storage.getContentItems(type as string);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content items" });
    }
  });

  // Get content item by ID
  app.get("/api/content-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log('🔍 GET /api/content-items/:id - Requested ID:', id, 'Type:', typeof id);

      const item = await storage.getContentItem(id);

      console.log('🔍 Database query result:', item ? 'Found item' : 'No item found');
      if (item) {
        console.log('📄 Item details:', {
          id: item.id,
          title: item.title,
          type: item.type,
          status: item.status,
          contentLength: Array.isArray(item.content) ? item.content.length : 'Not an array'
        });
      }

      if (!item) {
        console.error('❌ Content item not found for ID:', id);
        return res.status(404).json({ message: `Content item not found with ID: ${id}` });
      }

      console.log('✅ Returning content item:', item.id, item.title);
      res.json(item);
    } catch (error) {
      console.error("❌ Error fetching content item:", error);
      res.status(500).json({ message: "Failed to fetch content item: " + (error as Error).message });
    }
  });

  // Check for duplicate content route
  app.post("/api/content-items/check-duplicate", requireAuth, async (req, res) => {
    try {
      const { title, slug, type } = req.body;
      const existingItem = await storage.findContentItemByTitleOrSlug(title, slug, type);
      res.json({ exists: !!existingItem, item: existingItem });
    } catch (error) {
      res.status(500).json({ message: "Failed to check for duplicates" });
    }
  });

  app.post("/api/content-items", requireAuth, async (req, res) => {
    try {
      const { forceCreate, ...data } = req.body;

      // Check for duplicates unless forced
      if (!forceCreate) {
        const existingItem = await storage.findContentItemByTitleOrSlug(data.title, data.slug, data.type);
        if (existingItem) {
          return res.status(409).json({
            message: "Duplicate content detected",
            duplicate: existingItem,
            action: "confirm"
          });
        }
      }

      // Generate unique slug if needed
      let finalSlug = data.slug;
      if (forceCreate) {
        finalSlug = await storage.generateUniqueSlug(data.slug, data.type);
      }

      const dataForValidation = {
        ...data,
        slug: finalSlug,
        authorId: req.userId,
        scheduledPublishDate: data.scheduledDate ? new Date(data.scheduledDate) : null
      };

      delete dataForValidation.scheduledDate;

      const validatedData = insertContentItemSchema.parse(dataForValidation);
      const item = await storage.createContentItem(validatedData);

      // Hard link: if a keywordId was provided, update the keyword with the new content item id
      if (validatedData.keywordId) {
        try {
          await storage.updateKeyword(validatedData.keywordId, {
            contentItemId: String(item.id),
            contentItemTitle: item.title,
            status: "in_progress",
          });
        } catch {
          // Non-fatal — don't block content creation if keyword sync fails
        }
      }

      res.json(item);
    } catch (error) {
      console.error('Content item creation error:', error);
      res.status(400).json({ message: "Invalid data: " + (error as Error).message });
    }
  });

  app.post("/api/content-items/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const rawId = req.params.id;
      const id: number | string = /^\d+$/.test(rawId) ? parseInt(rawId) : rawId;
      const original = await storage.getContentItem(id);
      if (!original) return res.status(404).json({ message: "Content item not found" });

      const { id: _id, createdAt, updatedAt, publishedAt, klaviyoTemplateId, ...rest } = original as any;
      const copy = await storage.createContentItem({
        ...rest,
        title: `Copy of ${original.title}`,
        slug: original.slug ? `${original.slug}-copy-${Date.now()}` : null,
        status: "draft",
        approvalStatus: "pending",
        authorId: req.userId,
        scheduledPublishDate: null,
      } as any);

      // Duplicate content blocks only for non-email types (emails store blocks inline in content JSON)
      const isEmailType = original.type?.includes('email');
      if (!isEmailType) {
        const numericId = typeof id === "number" ? id : (isNaN(parseInt(String(id))) ? null : parseInt(String(id)));
        if (numericId !== null) {
          const blocks = await storage.getContentBlocks(numericId);
          for (const block of blocks) {
            const { id: _bid, contentItemId: _cid, createdAt: _bc, updatedAt: _bu, ...blockRest } = block as any;
            await storage.createContentBlock({ ...blockRest, contentItemId: copy.id });
          }
        }
      }

      res.json(copy);
    } catch (error) {
      console.error("Duplicate error:", error);
      res.status(500).json({ message: "Failed to duplicate: " + (error as Error).message });
    }
  });

  app.put("/api/content-items/:id", requireAuth, async (req, res) => {
    try {
      const rawId = req.params.id;
      const id: number | string = /^\d+$/.test(rawId) ? parseInt(rawId) : rawId;
      const body = { ...req.body };

      if (body.structuredDataType) {
        body.structuredData = { "@context": "https://schema.org", "@type": body.structuredDataType };
        delete body.structuredDataType;
      }
      const item = await storage.updateContentItem(id, body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update content item" });
    }
  });

  app.patch("/api/content-items/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      console.log('📝 PATCH /api/content-items/:id called');
      console.log('📝 Content ID:', id);

      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: 'Invalid request body' });
      }

      const updateData = req.body;

      const processedUpdateData = { ...updateData };
      if (processedUpdateData.scheduledDate) {
        processedUpdateData.scheduledPublishDate = new Date(processedUpdateData.scheduledDate);
        delete processedUpdateData.scheduledDate;
      }

      // Convert structuredDataType string → full JSON-LD structured_data object
      if (processedUpdateData.structuredDataType) {
        const sdType = processedUpdateData.structuredDataType;
        processedUpdateData.structuredData = { "@context": "https://schema.org", "@type": sdType };
        delete processedUpdateData.structuredDataType;
      }

      let item;
      if (/^\d+$/.test(id)) {
        if (processedUpdateData.content && !Array.isArray(processedUpdateData.content)) {
          processedUpdateData.content = [{ type: 'paragraph', content: processedUpdateData.content, order: 0 }];
        }
        item = await storage.updateContentItem(parseInt(id), processedUpdateData);
      } else {
        if (processedUpdateData.content && Array.isArray(processedUpdateData.content)) {
          const COMPLEX_BLOCK_TYPES = new Set([
            'product_feature', 'product_row', 'promo_code', 'review',
            'gif_image', 'countdown_timer', 'progress_loyalty',
            'hero', 'two_column', 'accordion', 'banner', 'icon_text_row',
            'author_bio', 'breadcrumb', 'related_content',
            'divider', 'spacer', 'cta', 'quote',
            'shopify_product_card', 'shopify_product_grid',
            'shopify_collection_feature', 'shopify_variant_selector',
            'app_block', 'html_block',
          ]);

          const transformedContent = processedUpdateData.content.map((block: any, index: number) => {
            const safeBlock = {
              id: block.id || `block_${Date.now()}_${index}`,
              type: block.type || 'text',
              order: block.order !== undefined ? block.order : index,
              content: {} as Record<string, any>
            };

            if (block.content && typeof block.content === 'object') {
              if (COMPLEX_BLOCK_TYPES.has(block.type)) {
                safeBlock.content = { ...block.content };
              } else {
                const allowedProps = [
                  'text', 'items', 'url', 'src', 'alt', 'caption', 'author',
                  'buttonText', 'link', 'level', 'ordered', 'style',
                  // Image layout
                  'widthMode', 'customWidth', 'align',
                  // Text styling
                  'textColor', 'backgroundColor', 'backgroundImageUrl',
                  'fontSize', 'fontWeight', 'textAlign', 'fontStyle',
                  'textDecoration', 'textTransform', 'minHeight',
                ];
                for (const prop of allowedProps) {
                  if (block.content[prop] !== undefined) {
                    if (prop === 'items' && Array.isArray(block.content[prop])) {
                      safeBlock.content[prop] = [...block.content[prop]];
                    } else {
                      safeBlock.content[prop] = block.content[prop];
                    }
                  }
                }
              }
            } else if (typeof block.content === 'string') {
              safeBlock.content = { text: block.content };
            }

            if (!safeBlock.content || Object.keys(safeBlock.content).length === 0) {
              safeBlock.content = { text: '' };
            }

            return safeBlock;
          });
          processedUpdateData.content = transformedContent;
        }

        item = await storage.updateContentItem(id as any, processedUpdateData);
      }

      console.log(`✅ Updated content item ${id} successfully`);

      // Publish lifecycle: if content is marked published, update all linked keyword statuses
      if (updateData.status === "published") {
        try {
          const linkedKws = await storage.getKeywordsByContentItemId(String(id));
          for (const kw of linkedKws) {
            if (kw.status !== "published") {
              await storage.updateKeyword(kw.id, { status: "published" });
            }
          }
        } catch {
          // Non-fatal — don't fail the content update if keyword sync fails
        }
      }

      res.json(item);
    } catch (error) {
      console.error(`❌ Failed to update content item ${id}:`, error);
      if (error instanceof Error) {
        res.status(500).json({ message: "Failed to update content item: " + error.message });
      } else {
        res.status(500).json({ message: "An unknown error occurred during content update." });
      }
    }
  });

  app.post("/api/content-items/:id/publish", requireAuth, async (req, res) => {
    try {
      const rawId = req.params.id;
      const id = /^\d+$/.test(rawId) ? parseInt(rawId) : rawId;
      const item = await storage.publishContentItem(id);

      // Purge Cloudflare edge cache if configured
      if (process.env.CF_ZONE_ID && process.env.CF_API_TOKEN && item.slug) {
        // Use SITE_BASE_URL if available, otherwise default to welltolddesign.com
        const baseUrl = process.env.SITE_BASE_URL || "https://welltolddesign.com";
        const purgeUrl = `${baseUrl}/a/articles/${item.slug}`;
        
        console.log(`Attempting Cloudflare cache purge for: ${purgeUrl}`);
        try {
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ files: [purgeUrl] }),
            }
          );
          
          if (response.ok) {
            console.log(`✅ Cloudflare cache purged for: ${purgeUrl}`);
          } else {
            const errorText = await response.text();
            console.warn(`⚠️ Cloudflare cache purge failed with status ${response.status}: ${errorText}`);
          }
        } catch (cfError) {
          console.warn("⚠️ Cloudflare cache purge failed (non-fatal):", cfError);
        }
      }

      // Publish lifecycle: sync all linked keyword statuses when content is published via this route
      try {
        const linkedKws = await storage.getKeywordsByContentItemId(rawId);
        for (const kw of linkedKws) {
          if (kw.status !== "published") {
            await storage.updateKeyword(kw.id, { status: "published" });
          }
        }
      } catch {
        // Non-fatal
      }

      const baseUrl = process.env.SITE_BASE_URL || "https://welltolddesign.com";

      res.json({ ...item, url: item.slug ? `${baseUrl}/a/articles/${item.slug}` : null });
    } catch (error) {
      console.error("Failed to publish content item:", error);
      res.status(500).json({ message: "Failed to publish content item" });
    }
  });

  app.delete("/api/content-items/:id", requireAuth, async (req, res) => {
    try {
      const rawId = req.params.id;
      const id: number | string = /^\d+$/.test(rawId) ? parseInt(rawId) : rawId;

      console.log(`Deleting content item ${id}...`);

      // For integer IDs (local email content), also delete associated blocks
      if (typeof id === 'number') {
        const blocks = await storage.getContentBlocks(id);
        for (const block of blocks) {
          try {
            await storage.deleteContentBlock(block.id);
          } catch (err) {
            console.error(`Failed to delete block ${block.id}:`, err);
          }
        }
      }

      await storage.deleteContentItem(id);
      console.log(`Successfully deleted content item ${id}`);
      res.json({ message: "Content item deleted successfully" });
    } catch (error) {
      console.error("Delete content item error:", error);
      res.status(500).json({
        message: "Failed to delete content item",
        error: (error as Error).message
      });
    }
  });

  // Content Blocks routes
  app.get("/api/content-items/:id/blocks", requireAuth, async (req, res) => {
    try {
      const contentItemId = parseInt(req.params.id);
      const blocks = await storage.getContentBlocks(contentItemId);
      res.json(blocks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content blocks" });
    }
  });

  app.post("/api/content-items/:id/blocks", requireAuth, async (req, res) => {
    try {
      const contentItemId = parseInt(req.params.id);
      const validatedData = insertContentBlockSchema.parse({
        ...req.body,
        contentItemId,
      });
      const block = await storage.createContentBlock(validatedData);
      res.json(block);
    } catch (error) {
      res.status(400).json({ message: "Invalid data: " + (error as Error).message });
    }
  });

  app.put("/api/content-items/:id/blocks/:blockId", requireAuth, async (req, res) => {
    try {
      const blockId = parseInt(req.params.blockId);
      const block = await storage.updateContentBlock(blockId, req.body);
      res.json(block);
    } catch (error) {
      res.status(500).json({ message: "Failed to update content block" });
    }
  });

  app.delete("/api/content-items/:id/blocks/:blockId", requireAuth, async (req, res) => {
    try {
      const blockId = parseInt(req.params.blockId);
      await storage.deleteContentBlock(blockId);
      res.json({ message: "Block deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete content blocks" });
    }
  });

  // Backward-compatible block routes (used by ContentBlock.tsx)
  app.put("/api/content-blocks/:blockId", requireAuth, async (req, res) => {
    try {
      const blockId = parseInt(req.params.blockId);
      const block = await storage.updateContentBlock(blockId, req.body);
      res.json(block);
    } catch (error) {
      res.status(500).json({ message: "Failed to update content block" });
    }
  });

  app.delete("/api/content-blocks/:blockId", requireAuth, async (req, res) => {
    try {
      const blockId = parseInt(req.params.blockId);
      await storage.deleteContentBlock(blockId);
      res.json({ message: "Block deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete content block" });
    }
  });

  // Profile Routes
  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const { displayName, firstName, lastName, avatarUrl, defaultTheme, backgroundColor } = req.body;
      const userId = req.userId;

      const updatedUser = await storage.updateUser(userId, {
        name: displayName || `${firstName || ''} ${lastName || ''}`.trim(),
        firstName,
        lastName,
        displayName,
        avatarUrl,
        defaultTheme,
        backgroundColor,
        initials: `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || undefined,
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Brand Context Routes
  const DEFAULT_BRAND_CONTEXT = {
    voiceDocument: `# Well Told Brand Voice

## Who We Are

Well Told is a gift brand. We make objects for people who think carefully about what they give — and who they give it to. Our products live at the intersection of craft, meaning, and everyday use. They're not decorative for decoration's sake. They tell a story, hold a value, or mark a moment.

We are a small brand that takes quality seriously. Every product decision is deliberate. Every word we write should reflect that same care.

## How We Talk

We talk like a thoughtful person, not a marketing department. We don't inflate. We don't use words like "amazing" or "incredible" because we've seen those words used to describe things that aren't. We trust our products to speak through honest, well-chosen language.

We are warm but not saccharine. We have a point of view but don't lecture. We believe in the power of a good gift without making people feel guilty for giving something simple.

We are occasionally quiet. Not every sentence needs to do heavy lifting. A short sentence after a long one feels intentional.

## The People We're Writing For

Our customers are thoughtful givers. They care about provenance, quality, and meaning. They're skeptical of fast fashion and mass-market noise. They appreciate when a brand treats them like an adult. They've probably already scrolled past three generic email blasts this morning — we do not want to be the fourth.

## Things We Believe

- The best gifts feel personal even when they're not personalized.
- Objects can hold memory and meaning in a way that digital things cannot.
- Giving is an act of attention — noticing someone well enough to choose something right for them.
- We give back because it's the right thing, not as a marketing tactic.

## Things We Never Do

- We never create false urgency. If a sale ends Friday, we say Friday.
- We never use countdown pressure as a substitute for a genuine offer.
- We don't over-exclaim. One exclamation mark per email maximum, if any.
- We don't call things "perfect" or "luxurious" — wrong register for us.
- We don't write in passive voice when active is available.
- We don't use "journey" as a metaphor for anything.

## Voice in Different Contexts

Product copy: Clear, specific, honest. Name the material. Name the process. Avoid adjectives that don't carry information.

Email subject lines: Short, direct, and intriguing without being clickbait. No emoji unless it genuinely adds something. Never all caps.

CTA buttons: Active verbs. Not "Click here" — "Shop the collection," "Read the story," "Explore the guide."

Storytelling / give-back copy: Take your time. Let the cause breathe before connecting it back to what we make.

Sale copy: Honest about the offer, brief about the urgency, still on-brand in voice. A sale email can still sound like Well Told.`,
    alwaysRules: [
      "Use sentence case for all headings — capitalize first word and proper nouns only",
      "Oxford comma in all lists",
      "Spell out numbers one through nine; use numerals for 10 and above",
      "Use em dashes (—) instead of hyphens for breaks in a sentence",
      "Keep email subject lines under 50 characters when possible",
      "Write CTA button text as an active verb phrase",
      "Preview text should be 85–100 characters and complement, not repeat, the subject line"
    ],
    avoidRules: [
      "Do not use exclamation marks more than once per email",
      "Do not use these words: amazing, incredible, perfect, luxurious, journey, synergy, seamless, elevate (in a sales context)",
      "Do not use passive voice when active is available",
      "Do not use Click here as CTA button text",
      "Do not write in all caps for emphasis",
      "Do not use manufactured urgency language (e.g., Don't miss out, Act now, Going fast) unless a genuine and specific deadline exists",
      "Do not use ellipses (...) for dramatic effect",
      "Do not start multiple consecutive sentences with We"
    ],
    wordsWeUse: ["crafted", "intentional", "grounded", "honest", "considered", "quietly", "useful", "made", "gathered", "thoughtful", "specific", "earned"],
    wordsWeAvoid: ["amazing", "incredible", "perfect", "luxurious", "journey", "synergy", "seamless", "curated", "obsessed", "excited to announce", "game-changer"]
  };

  app.get("/api/settings/brand-context", requireAuth, async (req, res) => {
    try {
      const context = await storage.getBrandContext();
      
      if (!context || (!context.voiceDocument && (!context.alwaysRules || context.alwaysRules.length === 0))) {
        return res.json({ ...DEFAULT_BRAND_CONTEXT, id: '00000000-0000-0000-0000-000000000001', updatedAt: new Date() });
      }

      res.json(context);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch brand context" });
    }
  });

  app.put("/api/settings/brand-context", requireAuth, async (req, res) => {
    try {
      const context = await storage.updateBrandContext(req.body);
      res.json(context);
    } catch (error) {
      res.status(500).json({ message: "Failed to update brand context" });
    }
  });

  // OpenAI routes
  app.post("/api/ai/generate-title", requireAuth, async (req, res) => {
    try {
      const { content, type, primaryKeyword, supportingKeywords, metaDescription, templateContext } = req.body;
      const { generateTitle } = await import("./services/claude");
      const result = await generateTitle(content, type, primaryKeyword, supportingKeywords, metaDescription, templateContext);
      res.json({ title: result });
    } catch (error) {
      console.error("AI title generation error:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/ai/generate-summary", requireAuth, async (req, res) => {
    try {
      const { content, title, type, primaryKeyword, supportingKeywords, templateContext } = req.body;
      const { generateMetaDescription } = await import("./services/claude");
      const result = await generateMetaDescription(title || content, type, primaryKeyword, supportingKeywords, templateContext);
      res.json({ summary: result });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/ai/improve-content", requireAuth, async (req, res) => {
    try {
      const { content, instructions, sectionType, type } = req.body;
      const result = await improveContent(content, instructions, sectionType || type);
      res.json({ content: result });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/ai/refine-content", requireAuth, async (req, res) => {
    try {
      const { content, feedback, type } = req.body;
      const result = await refineContent(content, feedback, type);
      res.json({ content: result });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/ai/generate-section", requireAuth, async (req, res) => {
    try {
      const { topic, sectionType, type, context } = req.body;
      const result = await generateSection(topic, sectionType || type, context);
      res.json({ content: result });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Route 1 — full template generation
  app.post("/api/ai/generate-content", requireAuth, async (req, res) => {
    try {
      const { template_type, mood, description, title_hint, context_fields, blocks, sibling_context } = req.body;
      if (!description) return res.status(400).json({ success: false, error: "description_required" });

      let brandContext: Record<string, any> = {};
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data } = await sb.from("brand_context").select("*").eq("id", "00000000-0000-0000-0000-000000000001").single();
        if (data) brandContext = data;
      } catch (e) {
        console.warn("Could not fetch brand_context, proceeding without it");
      }

      const { generateContent } = await import("./services/claude");
      const { template_system_prompt, template_user_prompt_addition } = req.body;
      const result = await generateContent({
        description,
        title_hint,
        mood: mood || "conversational",
        template_type: template_type || "email",
        context_fields,
        blocks: blocks || [],
        sibling_context,
        brand_context: brandContext,
        template_system_prompt: template_system_prompt || undefined,
        template_user_prompt_addition: template_user_prompt_addition || undefined,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Content generation error:", error);
      res.status(500).json({ success: false, error: "generation_failed", message: error?.message });
    }
  });

  // Route 2 — single block generation (used by per-block generate buttons)
  app.post("/api/ai/generate-block", requireAuth, async (req, res) => {
    try {
      const { block_id, block_type, block_notes, mood, description, template_type, sibling_context } = req.body;
      if (!block_id) return res.status(400).json({ success: false, error: "block_id_required" });

      let brandContext: Record<string, any> = {};
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data } = await sb.from("brand_context").select("*").eq("id", "00000000-0000-0000-0000-000000000001").single();
        if (data) brandContext = data;
      } catch (e) {
        console.warn("Could not fetch brand_context, proceeding without it");
      }

      const { generateContent } = await import("./services/claude");
      const result = await generateContent({
        description: description || "Generate appropriate copy for this content block",
        mood: mood || "conversational",
        template_type: template_type || "email",
        sibling_context,
        brand_context: brandContext,
        blocks: [{ block_id, block_type, ai_fillable: true, notes: block_notes }],
      });

      res.json({ success: true, content: result.generated[block_id] || "", mood_used: result.mood_used });
    } catch (error: any) {
      console.error("Block generation error:", error);
      res.status(500).json({ success: false, error: "generation_failed", message: error?.message });
    }
  });

  app.post("/api/ai/generate-complete-article", requireAuth, async (req, res) => {
    try {
      console.log('Received complete article generation request:', {
        body: req.body,
        user: req.userId
      });

      const cleanedBody = JSON.parse(JSON.stringify(req.body));

      const {
        title,
        type,
        primaryKeyword,
        supportingKeywords,
        articleAngle,
        metaDescription,
        template,
        additionalInstructions
      } = cleanedBody;

      if (!title || !type) {
        return res.status(400).json({ message: "Title and type are required" });
      }

      const { generateCompleteArticle } = await import("./services/claude");

      const result = await generateCompleteArticle({
        title,
        type,
        primaryKeyword,
        supportingKeywords,
        articleAngle: articleAngle || null,
        metaDescription,
        template,
        additionalInstructions,
      });

      // Server-side auto-resolution: attach image suggestions to image blocks
      const imageBlockIndices = result.sections
        .map((b: any, i: number) => ({ block: b, index: i }))
        .filter(({ block }: any) => block.type === 'image' && !isValidImageUrl(block.content?.url));

      if (imageBlockIndices.length > 0) {
        const suggestionJobs = imageBlockIndices.map(async ({ block, index }: any) => {
          const description = block.content?.alt || block.content?.caption || "";
          const suggestions = await resolveImageSuggestions({
            description: description || undefined,
            title,
            keyword: primaryKeyword || undefined,
          });
          return { index, suggestions };
        });

        const resolved = await Promise.allSettled(suggestionJobs);
        resolved.forEach((outcome) => {
          if (outcome.status === 'fulfilled' && outcome.value.suggestions.length > 0) {
            const { index, suggestions } = outcome.value;
            result.sections[index] = { ...result.sections[index], suggestedImages: suggestions };
          }
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Complete article generation error:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // ── Shopify Storefront proxy (editor preview only) ──────────────────────────
  app.get("/api/shopify/product/:id", requireAuth, async (req, res) => {
    try {
      const { fetchProduct } = await import("./services/shopify");
      const product = await fetchProduct(req.params.id);
      res.json(product);
    } catch (err) {
      res.status(502).json({ message: (err as Error).message });
    }
  });

  app.get("/api/shopify/collection/:id", requireAuth, async (req, res) => {
    try {
      const { fetchCollection } = await import("./services/shopify");
      const count = Math.min(Math.max(parseInt(String(req.query.count || "12"), 10) || 12, 1), 24);
      const collection = await fetchCollection(req.params.id, count);
      res.json(collection);
    } catch (err) {
      res.status(502).json({ message: (err as Error).message });
    }
  });

  app.get("/api/shopify/products", requireAuth, async (req, res) => {
    try {
      const { fetchProductList } = await import("./services/shopify");
      const count = Math.min(Math.max(parseInt(String(req.query.count || "40"), 10) || 40, 1), 40);
      const q = String(req.query.q || "").trim() || undefined;
      const after = String(req.query.after || "").trim() || undefined;
      const result = await fetchProductList(count, q, after);
      res.json(result);
    } catch (err) {
      res.status(502).json({ message: (err as Error).message });
    }
  });

  app.get("/api/shopify/collections", requireAuth, async (req, res) => {
    try {
      const { fetchCollectionList } = await import("./services/shopify");
      const count = Math.min(Math.max(parseInt(String(req.query.count || "40"), 10) || 40, 1), 40);
      const q = String(req.query.q || "").trim() || undefined;
      const after = String(req.query.after || "").trim() || undefined;
      const result = await fetchCollectionList(count, q, after);
      res.json(result);
    } catch (err) {
      res.status(502).json({ message: (err as Error).message });
    }
  });

  app.get("/api/shopify/pages", requireAuth, async (req, res) => {
    try {
      const { fetchPages } = await import("./services/shopify");
      const count = Math.min(Math.max(parseInt(String(req.query.count || "20"), 10) || 20, 1), 50);
      const pages = await fetchPages(count);
      res.json(pages);
    } catch (err) {
      res.status(502).json({ message: (err as Error).message });
    }
  });

  app.get("/api/shopify/images", requireAuth, async (req, res) => {
    try {
      const { fetchImages } = await import("./services/shopify");
      const count = Math.min(Math.max(parseInt(String(req.query.count || "20"), 10) || 20, 1), 50);
      const images = await fetchImages(count);
      res.json(images);
    } catch (err) {
      res.status(502).json({ message: (err as Error).message });
    }
  });

  // Email preview endpoint
  // ── Temporary email preview store ──────────────────────────────────────────
  // Authenticated POST stores rendered HTML with a UUID key (5-min TTL).
  // Unauthenticated GET serves it so a plain <iframe src="..."> can load it
  // without needing an Authorization header, while still being secure via UUID.
  const emailPreviewStore = new Map<string, { html: string; expiresAt: number }>();

  app.post("/api/email-preview-temp", requireAuth, async (req, res) => {
    const { html } = req.body as { html?: string };
    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "html is required" });
    }
    const { randomUUID } = await import("crypto");
    const id = randomUUID();
    emailPreviewStore.set(id, { html, expiresAt: Date.now() + 5 * 60 * 1000 });
    // Clean up expired entries lazily
    for (const [k, v] of emailPreviewStore) {
      if (v.expiresAt < Date.now()) emailPreviewStore.delete(k);
    }
    res.json({ id });
  });

  app.get("/api/email-preview-temp/:id", async (req, res) => {
    const entry = emailPreviewStore.get(req.params.id);
    if (!entry || entry.expiresAt < Date.now()) {
      emailPreviewStore.delete(req.params.id);
      return res.status(404).send("Preview expired or not found");
    }
    // Remove Helmet's CSP header so we can set a permissive one that allows
    // external images (Cloudinary). Multiple CSP headers = browser enforces all,
    // so we must clear the Helmet-generated one first.
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy",
      "default-src 'none'; img-src * data:; style-src 'unsafe-inline' https:; font-src https: data:; script-src 'none'; object-src 'none'; frame-ancestors 'self';"
    );
    res.send(entry.html);
  });

  app.get("/api/content/:id/email-preview", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const parsedId: number | string = /^\d+$/.test(id) ? parseInt(id) : id;
      const item = await storage.getContentItem(parsedId);
      if (!item) {
        return res.status(404).json({ message: "Content item not found" });
      }

      // ── Diagnostic logging ────────────────────────────────────────────────
      const contentIsArray = Array.isArray(item.content);
      console.log(`📧 Email preview for item ${id}:`);
      console.log(`   content is array: ${contentIsArray}`);
      console.log(`   content length: ${contentIsArray ? (item.content as any[]).length : "n/a"}`);
      if (contentIsArray) {
        (item.content as any[]).forEach((b: any, i: number) => {
          console.log(`   block[${i}]: type=${b.type} content=${JSON.stringify(b.content)}`);
        });
      } else {
        console.log(`   content value: ${JSON.stringify(item.content)?.slice(0, 200)}`);
      }
      // ──────────────────────────────────────────────────────────────────────

      const { renderEmailForItem } = await import("./renderer/renderEmailForItem");
      const { html } = await renderEmailForItem(item);
      console.log(`   rendered HTML length: ${html.length}`);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      console.error("Email preview error:", error);
      res.status(500).json({ message: "Failed to render email preview: " + (error as Error).message });
    }
  });

  // Send test email endpoint
  app.post("/api/content/:id/send-test-email", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const { email } = req.body as { email?: string };
      if (!email || !email.includes("@")) {
        return res.status(400).json({ message: "A valid email address is required." });
      }

      const parsedId: number | string = /^\d+$/.test(id) ? parseInt(id) : id;
      const item = await storage.getContentItem(parsedId);
      if (!item) return res.status(404).json({ message: "Content item not found" });

      const itemContentType = (item.contentType ?? item.type ?? "");
      if (item.type !== "email" && !itemContentType.startsWith("email")) {
        return res.status(400).json({ message: "Send-test is only available for email content." });
      }

      const { renderEmailForItem } = await import("./renderer/renderEmailForItem");
      const { html } = await renderEmailForItem(item);

      // Delegate to Klaviyo service
      const { sendTestEmail } = await import("./services/klaviyo");
      const subject = item.title ? `[TEST] ${item.title}` : "[TEST] Email preview";
      await sendTestEmail(html, email, subject);

      res.json({ success: true, message: `Test email sent to ${email}` });
    } catch (error: unknown) {
      console.error("Send test email error:", error);
      const { KlaviyoNotConnectedError } = await import("./services/klaviyo");
      if (error instanceof KlaviyoNotConnectedError) {
        return res.status(400).json({ message: "klaviyo_required", detail: "Connect Klaviyo in Integrations to enable test sends." });
      }
      res.status(500).json({ message: "Failed to send test email: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Push to Klaviyo — renders current blocks as HTML then creates/updates a Klaviyo template
  app.post("/api/content/:id/push-to-klaviyo", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const parsedId: number | string = /^\d+$/.test(id) ? parseInt(id) : id;
      const item = await storage.getContentItem(parsedId);
      if (!item) return res.status(404).json({ message: "Content item not found" });

      const itemContentType = (item.contentType ?? item.type ?? "");
      if (item.type !== "email" && !itemContentType.startsWith("email")) {
        return res.status(400).json({ message: "Push to Klaviyo is only available for email content." });
      }

      const { renderEmailForItem } = await import("./renderer/renderEmailForItem");
      const { html } = await renderEmailForItem(item);

      // Push to Klaviyo (create new or update existing)
      const { pushTemplate } = await import("./services/klaviyo");
      const result = await pushTemplate(
        item.title || "Untitled Email",
        html,
        item.klaviyoTemplateId ?? null,
      );

      // Persist the Klaviyo template ID so future pushes update in-place
      await storage.updateContentItem(parsedId, { klaviyoTemplateId: result.id });

      res.json({ success: true, templateId: result.id, url: result.url });
    } catch (error: unknown) {
      console.error("Push to Klaviyo error:", error);
      const { KlaviyoNotConnectedError } = await import("./services/klaviyo");
      if (error instanceof KlaviyoNotConnectedError) {
        return res.status(400).json({ message: "klaviyo_required", detail: "Connect Klaviyo in Integrations to enable Klaviyo push." });
      }
      res.status(500).json({ message: "Failed to push to Klaviyo: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // List Klaviyo audiences (lists + segments) for campaign audience picker
  app.get("/api/klaviyo/audiences", requireAuth, async (req, res) => {
    try {
      const { listAudiences } = await import("./services/klaviyo");
      const audiences = await listAudiences();
      res.json(audiences);
    } catch (error: unknown) {
      const { KlaviyoNotConnectedError } = await import("./services/klaviyo");
      if (error instanceof KlaviyoNotConnectedError) {
        return res.status(400).json({ message: "klaviyo_required" });
      }
      res.status(500).json({ message: "Failed to fetch audiences: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Push to Klaviyo Campaign — renders email HTML then creates a new draft campaign
  app.post("/api/content/:id/push-to-klaviyo-campaign", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const parsedId: number | string = /^\d+$/.test(id) ? parseInt(id) : id;
      const item = await storage.getContentItem(parsedId);
      if (!item) return res.status(404).json({ message: "Content item not found" });

      const itemContentType = (item.contentType ?? item.type ?? "");
      if (item.type !== "email" && !itemContentType.startsWith("email")) {
        return res.status(400).json({ message: "Push to Campaign is only available for email content." });
      }

      const { subject, audienceId, audienceType, campaignName, fromName, fromEmail } = req.body as {
        subject: string;
        audienceId: string;
        audienceType: "list" | "segment";
        campaignName?: string;
        fromName?: string;
        fromEmail?: string;
      };

      if (!subject?.trim()) return res.status(400).json({ message: "Subject line is required." });
      if (!audienceId?.trim()) return res.status(400).json({ message: "Audience selection is required." });
      if (!audienceType || !["list", "segment"].includes(audienceType)) {
        return res.status(400).json({ message: "Invalid audience type." });
      }

      const previousCampaignId = item.klaviyoCampaignId ?? null;

      const { renderEmailForItem } = await import("./renderer/renderEmailForItem");
      const { html } = await renderEmailForItem(item);

      const { createCampaign } = await import("./services/klaviyo");
      const result = await createCampaign({
        name: campaignName || item.title || "Untitled Email",
        subject: subject.trim(),
        fromEmail: fromEmail?.trim() || "help@welltolddesign.com",
        fromLabel: fromName?.trim() || "Well Told",
        audienceId,
        audienceType,
        html,
      });

      // Persist the latest campaign ID for reference
      await storage.updateContentItem(parsedId, { klaviyoCampaignId: result.id });

      res.json({ success: true, campaignId: result.id, url: result.url, previousCampaignId });
    } catch (error: unknown) {
      console.error("Push to Klaviyo Campaign error:", error);
      const { KlaviyoNotConnectedError } = await import("./services/klaviyo");
      if (error instanceof KlaviyoNotConnectedError) {
        return res.status(400).json({ message: "klaviyo_required", detail: "Connect Klaviyo in Integrations to enable campaign push." });
      }
      res.status(500).json({ message: "Failed to push campaign: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Supabase publishing routes
  app.post("/api/publish/supabase", requireAuth, async (req, res) => {
    try {
      const { contentId, contentType } = req.body;
      console.log('📤 Publishing to Supabase:', { contentId, contentType });

      const contentItem = await storage.getContentItem(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content item not found" });
      }

      // Ensure content_markdown is present before publishing so the Cloudflare Worker
      // can consume it. Fetch content_json directly from Supabase (bypassing the
      // storage abstraction which returns content_markdown as a string when set).
      const webpageTableMap: Record<string, string> = {
        blog_article: "blog_articles",
        landing_page: "landing_pages",
        lead_magnet: "lead_magnets",
        blog: "blog_articles",
        landing: "landing_pages",
      };
      const publishTableName = webpageTableMap[contentItem.contentType || contentItem.type];
      if (publishTableName) {
        const { data: publishRow } = await supabaseClient
          .from(publishTableName)
          .select("content_json, content_markdown, title")
          .eq("id", contentId)
          .single();
        if (publishRow && !publishRow.content_markdown && Array.isArray(publishRow.content_json) && publishRow.content_json.length > 0) {
          const autoMarkdown = generateWebPageMarkdown(publishRow.content_json, publishRow.title || contentItem.title);
          await supabaseClient
            .from(publishTableName)
            .update({ content_markdown: autoMarkdown, updated_at: new Date().toISOString() })
            .eq("id", contentId);
          console.log(`✅ Auto-generated content_markdown for ${contentId} before publish`);
        }
      }

      const result = await supabaseLegacyPublisher.publish(contentItem);

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

      res.json(result);
    } catch (error) {
      console.error('Supabase publish error:', error);
      res.status(500).json({ message: "Failed to publish to Supabase: " + (error as Error).message });
    }
  });

  app.post("/api/publish/supabase/unpublish", requireAuth, async (req, res) => {
    try {
      const { contentId, contentType } = req.body;
      const contentItem = await storage.getContentItem(contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content item not found" });
      }

      const result = await supabaseLegacyPublisher.unpublish(contentItem);
      res.json(result);
    } catch (error) {
      console.error('Supabase unpublish error:', error);
      res.status(500).json({ message: "Failed to unpublish from Supabase: " + (error as Error).message });
    }
  });

  app.get("/api/publish/supabase/status/:slug/:table", requireAuth, async (req, res) => {
    try {
      const { slug, table } = req.params;
      const status = { published: true, url: `/${table}/${slug}` };
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to check Supabase status: " + (error as Error).message });
    }
  });

  // Published content endpoint for Publisher page
  app.get("/api/published-content", requireAuth, async (req, res) => {
    try {
      console.log('🔐 User authenticated:', req.userId);
      const { type, status, dateFrom, dateTo, search } = req.query;

      let contentItems = await storage.getContentItems();

      if (type && type !== 'all') {
        // Filter by top-level type ('webpage'/'email') or subtype ('blog_article' etc.)
        contentItems = contentItems.filter(item =>
          item.type === type || item.contentType === type
        );
      }

      if (status && status !== 'all') {
        if (status === 'approved') {
          contentItems = contentItems.filter(item => item.approvalStatus?.toLowerCase() === 'approved');
        } else {
          contentItems = contentItems.filter(item => item.status === status);
        }
      } else {
        contentItems = contentItems.filter(item => item.approvalStatus?.toLowerCase() === 'approved');
      }

      if (search) {
        const searchLower = (search as string).toLowerCase();
        contentItems = contentItems.filter(item =>
          item.title.toLowerCase().includes(searchLower) ||
          (item.metaDescription && item.metaDescription.toLowerCase().includes(searchLower))
        );
      }

      if (dateFrom) {
        const fromDate = new Date(dateFrom as string);
        contentItems = contentItems.filter(item => new Date(item.createdAt) >= fromDate);
      }

      if (dateTo) {
        const toDate = new Date(dateTo as string);
        contentItems = contentItems.filter(item => new Date(item.createdAt) <= toDate);
      }

      const publishedContent = await Promise.all(contentItems.map(async (item) => {
        let previewContent = '';
        if (Array.isArray(item.content)) {
          const textBlocks = item.content
            .filter((block: any) => block.type === 'paragraph' || block.type === 'text')
            .slice(0, 2);
          previewContent = textBlocks
            .map((block: any) => (typeof block.content === 'object' ? block.content.text : block.content) || '')
            .join(' ')
            .substring(0, 200);
        } else if (typeof item.content === 'string') {
          previewContent = (item.content as string).substring(0, 200);
        }

        return {
          id: item.id,
          title: item.title,
          type: item.type,
          contentType: item.contentType || null,
          status: item.status,
          approvalStatus: item.approvalStatus,
          publishedAt: item.publishedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          slug: item.slug,
          metaDescription: item.metaDescription,
          previewContent,
          blockCount: Array.isArray(item.content) ? item.content.length : 0,
          content: item.content,
        };
      }));

      res.json(publishedContent);
    } catch (error) {
      console.error('Published content error:', error);
      res.status(500).json({ message: "Failed to fetch published content: " + (error as Error).message });
    }
  });

  // Templates routes
  const WEBPAGE_TYPES = ["blog_article", "landing_page", "lead_magnet"] as const;
  const EMAIL_TYPES = ["email_campaign", "email_flow"] as const;

  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      const { type, category, search } = req.query;
      let query = supabaseClient.from('templates').select('*');

      // category=webpage forces only webpage types; category=email forces only email types
      // Both category guard and type filter can be applied simultaneously
      if (category === 'webpage') {
        if (type && type !== 'all' && WEBPAGE_TYPES.includes(type as typeof WEBPAGE_TYPES[number])) {
          // Subtype filter within the webpage category
          query = query.eq('type', type);
        } else {
          query = query.in('type', [...WEBPAGE_TYPES]);
        }
      } else if (category === 'email') {
        if (type && type !== 'all' && EMAIL_TYPES.includes(type as typeof EMAIL_TYPES[number])) {
          // Subtype filter within the email category
          query = query.eq('type', type);
        } else {
          query = query.in('type', [...EMAIL_TYPES]);
        }
      } else if (type && type !== 'all') {
        // No category guard — allow explicit type filter
        query = query.eq('type', type);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data || []) as Record<string, unknown>[];
      res.json(rows.map(expandEmailTemplate));
    } catch (error) {
      console.error('Templates fetch error:', error);
      res.status(500).json({ message: "Failed to fetch templates: " + (error as Error).message });
    }
  });

  app.get("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
const { data, error } = await supabaseClient.from('templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(expandEmailTemplate(data as Record<string, unknown>));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template: " + (error as Error).message });
    }
  });

  const VALID_TEMPLATE_TYPES = ["blog_article", "landing_page", "lead_magnet", "email_campaign", "email_flow"] as const;
  const EMAIL_TEMPLATE_TYPES_SET = new Set(["email_campaign", "email_flow"]);

  function validateTemplateType(type: unknown): string | null {
    if (!type) return "type is required";
    if (!VALID_TEMPLATE_TYPES.includes(type as typeof VALID_TEMPLATE_TYPES[number])) {
      return `Invalid type "${type}". Must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}`;
    }
    return null;
  }

  // Pack email-specific settings INTO the structure JSONB field so we don't need
  // separate DB columns (preheader_text, email_header, email_footer).
  // DB stores: structure = { blocks: [...], email_settings: { preheader_text, email_header, email_footer } }
  function packEmailFields(body: Record<string, unknown>): Record<string, unknown> {
    if (!EMAIL_TEMPLATE_TYPES_SET.has(body.type as string)) return body;

    const existingStructure = body.structure;
    const currentBlocks: unknown[] = Array.isArray(existingStructure)
      ? existingStructure
      : Array.isArray((existingStructure as any)?.blocks)
        ? (existingStructure as any).blocks
        : [];

    // Carry over any existing email_settings, then merge in whatever the caller sent.
    const existingEmailSettings: Record<string, unknown> =
      (!Array.isArray(existingStructure) && (existingStructure as any)?.email_settings) || {};

    const emailSettings: Record<string, unknown> = { ...existingEmailSettings };
    if ("preheader_text" in body) emailSettings.preheader_text = body.preheader_text ?? "";
    if ("email_header"   in body) emailSettings.email_header   = body.email_header   ?? {};
    if ("email_footer"   in body) emailSettings.email_footer   = body.email_footer   ?? {};

    const result: Record<string, unknown> = { ...body };
    result.structure = { blocks: currentBlocks, email_settings: emailSettings };
    delete result.preheader_text;
    delete result.email_header;
    delete result.email_footer;
    return result;
  }

  // Expand email settings from the packed structure back to top-level fields for API responses.
  function expandEmailTemplate(row: Record<string, unknown>): Record<string, unknown> {
    if (!EMAIL_TEMPLATE_TYPES_SET.has(row.type as string)) return row;

    const structure = row.structure;
    if (!structure) return { ...row, preheader_text: null, email_header: null, email_footer: null };

    // New packed format: { blocks: [...], email_settings: {...} }
    if (!Array.isArray(structure) && typeof structure === 'object' && (structure as any).blocks !== undefined) {
      const { blocks, email_settings } = structure as { blocks: unknown[]; email_settings?: Record<string, unknown> };
      const es = email_settings || {};
      return {
        ...row,
        structure: blocks,
        preheader_text: es.preheader_text ?? null,
        email_header:   es.email_header   ?? null,
        email_footer:   es.email_footer   ?? null,
      };
    }

    // Legacy format: structure is array of blocks with no email settings stored yet.
    return { ...row, preheader_text: null, email_header: null, email_footer: null };
  }

  app.post("/api/templates", requireAuth, async (req, res) => {
    try {
      const typeError = validateTemplateType(req.body.type);
      if (typeError) return res.status(400).json({ message: typeError });

      if (EMAIL_TEMPLATE_TYPES_SET.has(req.body.type) && !req.body.preheader_text) {
        return res.status(400).json({ message: "Email templates require preheader_text" });
      }

      const payload = packEmailFields(req.body);
      const { data, error } = await supabaseClient.from('templates')
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.json(expandEmailTemplate(data as Record<string, unknown>));
    } catch (error) {
      res.status(500).json({ message: "Failed to create template: " + (error as Error).message });
    }
  });

  app.put("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      if (req.body.type) {
        const typeError = validateTemplateType(req.body.type);
        if (typeError) return res.status(400).json({ message: typeError });

        if (EMAIL_TEMPLATE_TYPES_SET.has(req.body.type) && !req.body.preheader_text) {
          return res.status(400).json({
            message: "Email templates require preheader_text when setting or changing to an email type"
          });
        }
      }

      const payload = packEmailFields(req.body);
      const { data, error } = await supabaseClient.from('templates')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.json(expandEmailTemplate(data as Record<string, unknown>));
    } catch (error) {
      res.status(500).json({ message: "Failed to update template: " + (error as Error).message });
    }
  });

  app.delete("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
const { error } = await supabaseClient.from('templates')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template: " + (error as Error).message });
    }
  });

  app.post("/api/templates/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
const { data: template, error: fetchError } = await supabaseClient.from('templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const { id: _id, created_at, updated_at, ...templateData } = template;
      const { data, error } = await supabaseClient.from('templates')
        .insert({ ...templateData, name: `${template.name} (Copy)` })
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.json(expandEmailTemplate(data as Record<string, unknown>));
    } catch (error) {
      res.status(500).json({ message: "Failed to duplicate template: " + (error as Error).message });
    }
  });

  // Cloudinary routes
  app.get("/api/cloudinary/folders", requireAuth, async (req, res) => {
    try {
      const { cloudinary } = await import("./services/cloudinary");
      const result = await cloudinary.api.root_folders();
      res.json(result.folders || []);
    } catch (error) {
      console.error('Cloudinary folders error:', error);
      res.status(500).json({ message: "Failed to fetch Cloudinary folders" });
    }
  });

  app.get("/api/cloudinary/subfolders/:folder", requireAuth, async (req, res) => {
    try {
      const { cloudinary } = await import("./services/cloudinary");
      const { folder } = req.params;
      const result = await cloudinary.api.sub_folders(folder);
      res.json(result.folders || []);
    } catch (error) {
      console.error('Cloudinary subfolders error:', error);
      res.status(500).json({ message: "Failed to fetch subfolders" });
    }
  });

  app.get("/api/cloudinary/assets", requireAuth, async (req, res) => {
    try {
      const { cloudinary } = await import("./services/cloudinary");
      const { folder, search, next_cursor } = req.query;

      let searchOptions: any = {
        sort_by: [{ public_id: 'desc' }],
        max_results: 50,
      };

      if (next_cursor) {
        searchOptions.next_cursor = next_cursor;
      }

      let expression = 'resource_type:image';
      if (folder) {
        expression += ` AND folder="${folder}"`;
      }
      if (search) {
        expression += ` AND filename:${search}*`;
      }

      searchOptions.expression = expression;

      const result = await cloudinary.search.expression(expression)
        .sort_by('public_id', 'desc')
        .max_results(50)
        .execute();

      res.json({
        assets: result.resources || [],
        next_cursor: result.next_cursor,
        total_count: result.total_count,
      });
    } catch (error) {
      console.error('Cloudinary assets error:', error);
      res.status(500).json({ message: "Failed to fetch Cloudinary assets" });
    }
  });

  app.post("/api/images/suggest", requireAuth, async (req, res) => {
    try {
      const { description, title, keyword } = req.body;
      if (!description?.trim() && !keyword?.trim() && !title?.trim()) {
        return res.json({ suggestions: [] });
      }
      const suggestions = await resolveImageSuggestions({ description, title, keyword });
      res.json({ suggestions });
    } catch (error) {
      console.error('Image suggest error:', error);
      res.json({ suggestions: [] });
    }
  });

  app.get("/api/cloudinary/search", requireAuth, async (req, res) => {
    try {
      const { cloudinary } = await import("./services/cloudinary");
      const { folder, search, next_cursor } = req.query;

      let expression = 'resource_type:image';
      if (folder) {
        expression += ` AND folder="${folder}"`;
      }
      if (search) {
        expression += ` AND filename:${search}*`;
      }

      let query = cloudinary.search
        .expression(expression)
        .sort_by('public_id', 'desc')
        .max_results(50);

      if (next_cursor) {
        query = query.next_cursor(next_cursor as string);
      }

      const result = await query.execute();

      res.json({
        assets: result.resources || [],
        next_cursor: result.next_cursor,
        total_count: result.total_count,
      });
    } catch (error) {
      console.error('Cloudinary search error:', error);
      res.status(500).json({ message: "Failed to search Cloudinary assets" });
    }
  });

  app.get("/api/cloudinary/all-folders", requireAuth, async (req, res) => {
    try {
      const { cloudinary } = await import("./services/cloudinary");

      const result = await cloudinary.search
        .expression('resource_type:image')
        .aggregate('folder')
        .max_results(0)
        .execute();

      const folderSet = new Set<string>();
      if (result.aggregations?.folder) {
        Object.keys(result.aggregations.folder).forEach(folder => {
          folderSet.add(folder);
          const parts = folder.split('/');
          for (let i = 1; i < parts.length; i++) {
            folderSet.add(parts.slice(0, i).join('/'));
          }
        });
      }

      const folders = Array.from(folderSet).sort();
      res.json({ folders });
    } catch (error) {
      console.error('Cloudinary all-folders error:', error);
      res.status(500).json({ message: "Failed to fetch all folders" });
    }
  });

  app.post("/api/cloudinary/optimize", requireAuth, async (req, res) => {
    try {
      const { cloudinary } = await import("./services/cloudinary");
      const { publicId } = req.body;

      if (!publicId) {
        return res.status(400).json({ message: "publicId is required" });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;

      const variants = {
        original: cloudinary.url(publicId, { fetch_format: 'auto', quality: 'auto:best' }),
        thumbnail: `${baseUrl}/w_150,h_150,c_fill,q_auto:best,f_auto/${publicId}`,
        small: `${baseUrl}/w_400,q_auto:best,f_auto/${publicId}`,
        medium: `${baseUrl}/w_800,q_auto:best,f_auto/${publicId}`,
        large: `${baseUrl}/w_1200,q_auto:best,f_auto/${publicId}`,
        hero: `${baseUrl}/w_1920,q_auto:best,f_auto/${publicId}`,
      };

      res.json({ publicId, variants });
    } catch (error) {
      console.error('Cloudinary optimize error:', error);
      res.status(500).json({ message: "Failed to optimize image" });
    }
  });

  // Block renderer preview — renders a content item as full HTML for preview
  app.get("/api/content-items/:id/preview-html", async (req, res) => {
    try {
      const id = /^\d+$/.test(req.params.id) ? parseInt(req.params.id) : req.params.id;
      const item = await storage.getContentItem(id as any);
      if (!item) return res.status(404).json({ message: "Content item not found" });

      const reqOrigin = `${req.protocol}://${req.get("host")}`;
      const baseUrl = reqOrigin;

      // When the item's content is a markdown string (content_markdown was set via
      // Generate Markdown), render the markdown as HTML directly so the preview
      // matches what the Cloudflare Worker will serve.
      // Strip raw HTML tags first to guard against stored-XSS before passing
      // to the simple regex-based converter which does not have its own sanitizer.
      if (typeof item.content === "string" && item.content.trim()) {
        const safeMd = item.content.replace(/<[^>]*>/g, "");
        const bodyHtml = markdownToHtml(safeMd);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${item.title.replace(/</g, "&lt;")}</title>
  ${item.metaDescription ? `<meta name="description" content="${item.metaDescription.replace(/"/g, "&quot;")}" />` : ""}
  <link rel="stylesheet" href="${baseUrl}/styles/wt-pages.css" />
</head>
<body class="wt-page">
  <main class="wt-content">
    ${bodyHtml}
  </main>
</body>
</html>`;
        return res.set("Content-Type", "text/html").send(html);
      }

      const { renderPageHtml } = await import("./renderer/blockToHtml");
      // Only construct fetcher when env vars are present — avoids noisy fetch failures for unconfigured installs
      const shopifyFetcher = (process.env.SHOPIFY_STOREFRONT_TOKEN && process.env.SHOPIFY_STORE_DOMAIN)
        ? await import("./services/shopify").then((m) => ({ fetchProduct: m.fetchProduct, fetchCollection: m.fetchCollection }))
        : null;
      const html = await renderPageHtml({
        id: String(item.id),
        title: item.title,
        slug: item.slug,
        status: item.status,
        meta_description: item.metaDescription || null,
        content_json: Array.isArray(item.content) ? item.content : [],
        featured_image: item.featuredImage || null,
        og_image: (item as any).ogImage || null,
        og_title: (item as any).ogTitle || null,
        canonical_url: (item as any).canonicalUrl || null,
        page_template: (item as any).pageTemplate || "default",
        structured_data: (item as any).structuredData || null,
        custom_css: (item as any).customCss || null,
        redirect_from: (item as any).redirectFrom || null,
        updated_at: item.updatedAt?.toISOString(),
        published_at: item.publishedAt?.toISOString() || null,
      }, baseUrl, shopifyFetcher);
      res.set("Content-Type", "text/html").send(html);
    } catch (error) {
      res.status(500).json({ message: "Preview failed: " + (error as Error).message });
    }
  });

  // Markdown to HTML conversion
  app.post("/api/markdown-to-html", requireAuth, async (req, res) => {
    try {
      const { markdown } = req.body;
      if (!markdown) {
        return res.status(400).json({ message: "markdown is required" });
      }
      const html = await markdownToHtml(markdown);
      res.json({ html });
    } catch (error) {
      res.status(500).json({ message: "Failed to convert markdown: " + (error as Error).message });
    }
  });

  // Generate Markdown from block JSON and save to Supabase content_markdown field
  app.post("/api/pages/:id/generate-markdown", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Fetch the item header for title and content type
      const item = await storage.getContentItem(id as any);
      if (!item) return res.status(404).json({ message: "Content item not found" });

      const subtypeMap: Record<string, string> = {
        blog_article: "blog_articles",
        landing_page: "landing_pages",
        lead_magnet: "lead_magnets",
        blog: "blog_articles",
        landing: "landing_pages",
      };
      const tableName = subtypeMap[item.contentType || item.type];
      if (!tableName) {
        return res.status(400).json({ message: "Content type does not support markdown generation" });
      }

      // Always fetch content_json directly from Supabase to avoid the storage abstraction
      // returning content_markdown as a string (which would make block list appear empty)
      const { data: row, error: fetchErr } = await supabaseClient
        .from(tableName)
        .select("content_json, title")
        .eq("id", id)
        .single();
      if (fetchErr || !row) {
        return res.status(404).json({ message: "Page not found in Supabase" });
      }

      const blocks: any[] = Array.isArray(row.content_json) ? row.content_json : [];
      const title = row.title || item.title;
      const markdown = generateWebPageMarkdown(blocks, title);

      // Persist content_markdown while preserving content_json
      const { error: saveErr } = await supabaseClient
        .from(tableName)
        .update({ content_markdown: markdown, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (saveErr) {
        console.error("Failed to save content_markdown:", saveErr);
        return res.status(500).json({ message: "Markdown generated but could not be saved: " + saveErr.message });
      }

      res.json({ markdown, saved: true });
    } catch (error) {
      console.error("Generate markdown error:", error);
      res.status(500).json({ message: "Failed to generate markdown: " + (error as Error).message });
    }
  });

  // ── Public site settings (for Cloudflare Worker) ─────────────────────────────
  app.get("/api/public/site-settings", async (req, res) => {
    try {
      const rows = await db.select().from(siteSettings).limit(1);
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      res.json(rows[0] || {});
    } catch (error) {
      res.json({});
    }
  });

  // ── Block Presets ────────────────────────────────────────────────────────────
  app.get("/api/block-presets", requireAuth, async (req, res) => {
    try {
      const { type, channel } = req.query as Record<string, string>;
      let query = db.select().from(blockPresets).orderBy(desc(blockPresets.createdAt));
      const rows = await query;
      const filtered = rows.filter(r => {
        if (type && r.blockType !== type) return false;
        if (channel && r.channel && r.channel !== channel) return false;
        return true;
      });
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch block presets: " + (error as Error).message });
    }
  });

  app.post("/api/block-presets", requireAuth, async (req, res) => {
    try {
      const { name, description, blockType, channel, content } = req.body;
      if (!name || !blockType || !content) {
        return res.status(400).json({ message: "name, blockType, and content are required" });
      }
      const [row] = await db.insert(blockPresets).values({ name, description: description || null, blockType, channel: channel || null, content }).returning();
      res.status(201).json(row);
    } catch (error) {
      res.status(500).json({ message: "Failed to create block preset: " + (error as Error).message });
    }
  });

  app.put("/api/block-presets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description } = req.body;
      const [row] = await db.update(blockPresets).set({ name, description: description || null }).where(eq(blockPresets.id, id)).returning();
      if (!row) return res.status(404).json({ message: "Preset not found" });
      res.json(row);
    } catch (error) {
      res.status(500).json({ message: "Failed to update block preset: " + (error as Error).message });
    }
  });

  app.delete("/api/block-presets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(blockPresets).where(eq(blockPresets.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete block preset: " + (error as Error).message });
    }
  });

  // ── Site Settings ────────────────────────────────────────────────────────────
  app.get("/api/site-settings", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(siteSettings).limit(1);
      if (rows.length === 0) {
        const [row] = await db.insert(siteSettings).values({}).returning();
        return res.json(row);
      }
      res.json(rows[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch site settings: " + (error as Error).message });
    }
  });

  app.put("/api/site-settings", requireAuth, async (req, res) => {
    try {
      const {
        logoUrl, logoLink,
        announcementText, announcementLink, announcementBgColor, announcementTextColor, announcementEnabled,
        navLinks,
        primaryColor, accentColor,
        footerBgColor, footerColumns, footerAddress, footerLinks, footerCopyright,
        footerLogoUrl,
        footerAnnouncementEnabled, footerAnnouncementText, footerAnnouncementLink, footerAnnouncementBgColor, footerAnnouncementTextColor,
        socialHandle, socialLinks,
      } = req.body;
      const rows = await db.select().from(siteSettings).limit(1);
      const updateData = {
        logoUrl: logoUrl ?? null,
        logoLink: logoLink ?? "https://welltolddesign.com",
        footerLogoUrl: footerLogoUrl ?? null,
        announcementText: announcementText ?? "FREE SHIPPING Orders Over $50",
        announcementLink: announcementLink ?? "https://welltolddesign.com",
        announcementBgColor: announcementBgColor ?? "#000000",
        announcementTextColor: announcementTextColor ?? "#ffffff",
        announcementEnabled: announcementEnabled ?? true,
        navLinks: navLinks ?? [],
        primaryColor: primaryColor ?? "#000000",
        accentColor: accentColor ?? "#04a7cd",
        footerBgColor: footerBgColor ?? "#F5F5F5",
        footerColumns: footerColumns ?? [],
        footerAddress: footerAddress ?? null,
        footerLinks: footerLinks ?? [],
        footerCopyright: footerCopyright ?? "© 2026 Well Told. All rights reserved.",
        footerAnnouncementEnabled: footerAnnouncementEnabled ?? false,
        footerAnnouncementText: footerAnnouncementText ?? "",
        footerAnnouncementLink: footerAnnouncementLink ?? "",
        footerAnnouncementBgColor: footerAnnouncementBgColor ?? "#f0ebe7",
        footerAnnouncementTextColor: footerAnnouncementTextColor ?? "#000000",
        socialHandle: socialHandle ?? "@WellToldDesign",
        socialLinks: socialLinks ?? [],
        updatedAt: new Date(),
      };
      let row;
      if (rows.length === 0) {
        [row] = await db.insert(siteSettings).values(updateData).returning();
      } else {
        [row] = await db.update(siteSettings).set(updateData).where(eq(siteSettings.id, rows[0].id)).returning();
      }
      res.json(row);
    } catch (error) {
      res.status(500).json({ message: "Failed to update site settings: " + (error as Error).message });
    }
  });

  // ── Email Styles CRUD ────────────────────────────────────────────────────────
  app.get("/api/email-styles", requireAuth, async (_req, res) => {
    try {
      const rows = await db.select().from(emailStyles).orderBy(emailStyles.name);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email styles: " + (error as Error).message });
    }
  });

  app.post("/api/email-styles", requireAuth, async (req, res) => {
    try {
      const parsed = insertEmailStyleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [row] = await db.insert(emailStyles).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (error) {
      res.status(500).json({ message: "Failed to create email style: " + (error as Error).message });
    }
  });

  app.put("/api/email-styles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertEmailStyleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [row] = await db.update(emailStyles).set(parsed.data).where(eq(emailStyles.id, id)).returning();
      if (!row) return res.status(404).json({ message: "Email style not found" });
      res.json(row);
    } catch (error) {
      res.status(500).json({ message: "Failed to update email style: " + (error as Error).message });
    }
  });

  app.delete("/api/email-styles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(emailStyles).where(eq(emailStyles.id, id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete email style: " + (error as Error).message });
    }
  });

  // ── Integrations CRUD ────────────────────────────────────────────────────────
  app.get("/api/integrations", requireAuth, async (_req, res) => {
    try {
      const rows = await db.select().from(integrations).orderBy(integrations.createdAt);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/integrations", requireAuth, async (req, res) => {
    try {
      const parsed = insertIntegrationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [row] = await db.insert(integrations).values({ ...parsed.data, updatedAt: new Date() }).returning();
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.patch("/api/integrations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const parsed = insertIntegrationSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [row] = await db.update(integrations).set({ ...parsed.data, updatedAt: new Date() }).where(eq(integrations.id, id)).returning();
      if (!row) return res.status(404).json({ message: "Integration not found" });
      res.json(row);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/integrations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await db.delete(integrations).where(eq(integrations.id, id));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/integrations/:id/test-connection", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const rows = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
      if (rows.length === 0) return res.status(404).json({ message: "Integration not found" });
      const integration = rows[0];

      if (integration.type === "shopify") {
        const creds = integration.credentials as Record<string, string>;
        if (!creds?.storeDomain) {
          return res.status(400).json({ message: "Missing storeDomain or clientId/clientSecret" });
        }
        let result: { name: string; domain: string };
        if (creds.clientId && creds.clientSecret) {
          const { testWithClientCredentials } = await import("./services/shopifyTokenManager");
          result = await testWithClientCredentials(creds.storeDomain, creds.clientId, creds.clientSecret);
        } else if (creds.storefrontToken) {
          const { testShopifyConnection } = await import("./services/shopify");
          result = await testShopifyConnection(creds.storeDomain, creds.storefrontToken);
        } else {
          return res.status(400).json({ message: "Missing storeDomain or clientId/clientSecret" });
        }
        await db.update(integrations).set({ status: "connected", updatedAt: new Date() }).where(eq(integrations.id, id));
        return res.json({ success: true, shopName: result.name, domain: result.domain });
      }

      if (integration.type === "klaviyo") {
        const creds = integration.credentials as Record<string, string>;
        if (!creds?.apiKey) return res.status(400).json({ message: "Missing apiKey" });
        const resp = await fetch("https://a.klaviyo.com/api/accounts/", {
          headers: { Authorization: `Klaviyo-API-Key ${creds.apiKey}`, revision: "2024-02-15" },
        });
        if (!resp.ok) throw new Error(`Klaviyo API returned ${resp.status}`);
        const data = (await resp.json()) as any;
        const name = data?.data?.[0]?.attributes?.contact_information?.organization_name ?? "Klaviyo Account";
        await db.update(integrations).set({ status: "connected", updatedAt: new Date() }).where(eq(integrations.id, id));
        return res.json({ success: true, accountName: name });
      }

      return res.status(400).json({ message: `Test not supported for type: ${integration.type}` });
    } catch (err) {
      await db.update(integrations).set({ status: "error", updatedAt: new Date() }).where(eq(integrations.id, parseInt(req.params.id, 10)));
      res.status(502).json({ message: (err as Error).message });
    }
  });

  // Integrations: test credentials without saving (used when connecting a new integration)
  app.post("/api/integrations/test-credentials", requireAuth, async (req, res) => {
    try {
      const { type, credentials: creds } = req.body as { type: string; credentials: Record<string, string> };

      if (type === "shopify") {
        if (!creds?.storeDomain) {
          return res.status(400).json({ message: "Missing storeDomain or clientId/clientSecret" });
        }
        let result: { name: string; domain: string };
        if (creds.clientId && creds.clientSecret) {
          const { testWithClientCredentials } = await import("./services/shopifyTokenManager");
          result = await testWithClientCredentials(creds.storeDomain, creds.clientId, creds.clientSecret);
        } else if (creds.storefrontToken) {
          const { testShopifyConnection } = await import("./services/shopify");
          result = await testShopifyConnection(creds.storeDomain, creds.storefrontToken);
        } else {
          return res.status(400).json({ message: "Missing storeDomain or clientId/clientSecret" });
        }
        return res.json({ success: true, shopName: result.name, domain: result.domain });
      }

      if (type === "klaviyo") {
        if (!creds?.apiKey) return res.status(400).json({ message: "Missing apiKey" });
        const resp = await fetch("https://a.klaviyo.com/api/accounts/", {
          headers: { Authorization: `Klaviyo-API-Key ${creds.apiKey}`, revision: "2024-02-15" },
        });
        if (!resp.ok) throw new Error(`Klaviyo API returned ${resp.status}`);
        const data = (await resp.json()) as any;
        const name = data?.data?.[0]?.attributes?.contact_information?.organization_name ?? "Klaviyo Account";
        return res.json({ success: true, accountName: name });
      }

      return res.status(400).json({ message: `Test not supported for type: ${type}` });
    } catch (err) {
      res.status(502).json({ message: (err as Error).message });
    }
  });

  // Integrations: check if Shopify is configured (combines env + DB)
  app.get("/api/integrations/shopify-status", requireAuth, async (_req, res) => {
    try {
      const { isShopifyConfigured } = await import("./services/shopify");
      const configured = await isShopifyConfigured();
      res.json({ configured });
    } catch (err) {
      res.json({ configured: false });
    }
  });

  // ─── Keywords ────────────────────────────────────────────────────────────────
  // List keywords with optional filters
  app.get("/api/keywords", requireAuth, async (req, res) => {
    try {
      const { cluster, type, status, search } = req.query as Record<string, string>;
      const filters: Record<string, string> = {};
      if (cluster) filters.cluster = cluster;
      if (type) filters.type = type;
      if (status && status !== "all") filters.status = status;
      let kws = await storage.getKeywords(Object.keys(filters).length ? filters : undefined);
      // Optional text search (client-side filter on keyword text)
      if (search) {
        const lower = search.toLowerCase();
        kws = kws.filter((k) => k.keyword.toLowerCase().includes(lower));
      }
      res.json(kws);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch keywords" });
    }
  });

  const ARTICLE_ANGLES = [
    "Gift Guide — Standard",
    "Gift Guide — Passion-Led",
    "Story-Led — Mark the Moment",
    "Personal — The Gift That Actually Means Something",
    "Contrarian — Why These Gifts Are Always Boring",
    "Reframe — Gifts for the Parents, Not the Baby",
    "Informational — Build Authority",
  ] as const;

  const strictKeywordSchema = insertKeywordSchema.extend({
    keyword: z.string().trim().min(1, "Keyword must not be blank"),
    type: z.enum(["primary", "secondary"]).default("primary"),
    volume: z.number().int().nonnegative().nullish(),
    kd: z.number().int().min(0).nullish(),
    articleAngle: z.enum(ARTICLE_ANGLES).nullish(),
    priority: z.enum(["primary", "supporting"]).default("supporting"),
    status: z.enum(["untargeted", "in_progress", "published"]).default("untargeted"),
    contentTypeTarget: z.enum(["blog_article", "landing_page", "lead_magnet"]).nullish(),
  });

  // Create one keyword
  app.post("/api/keywords", requireAuth, async (req, res) => {
    try {
      const data = strictKeywordSchema.parse(req.body);
      const kw = await storage.createKeyword(data);
      res.status(201).json(kw);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Bulk create/upsert keywords from array of strings or keyword objects
  const bulkKeywordSchema = z.object({
    keywords: z.array(
      z.union([
        z.string().trim().min(1, "Keyword must not be blank"),
        z.object({
          keyword: z.string().trim().min(1, "Keyword must not be blank"),
          type: z.enum(["primary", "secondary"]).optional(),
          volume: z.number().int().nonnegative().nullish(),
          kd: z.number().int().min(0).nullish(),
          articleAngle: z.enum(ARTICLE_ANGLES).nullish(),
          priority: z.enum(["primary", "supporting"]).optional(),
          cluster: z.string().nullish(),
          contentTypeTarget: z.enum(["blog_article", "landing_page", "lead_magnet"]).nullish(),
          status: z.enum(["untargeted", "in_progress", "published"]).optional(),
        }),
      ])
    ).min(1),
    type: z.enum(["primary", "secondary"]).optional(),
    priority: z.enum(["primary", "supporting"]).optional(),
    cluster: z.string().nullish(),
    contentTypeTarget: z.enum(["blog_article", "landing_page", "lead_magnet"]).nullish(),
    status: z.enum(["untargeted", "in_progress", "published"]).optional(),
  });

  app.post("/api/keywords/bulk", requireAuth, async (req, res) => {
    try {
      const parsed = bulkKeywordSchema.parse(req.body);
      const inserts = parsed.keywords.map((k) => {
        if (typeof k === "string") {
          return insertKeywordSchema.parse({
            keyword: k.trim(),
            type: parsed.type ?? "primary",
            volume: null,
            kd: null,
            articleAngle: null,
            priority: parsed.priority ?? "supporting",
            cluster: parsed.cluster ?? null,
            contentTypeTarget: parsed.contentTypeTarget ?? null,
            status: parsed.status ?? "untargeted",
          });
        }
        return insertKeywordSchema.parse({
          keyword: k.keyword.trim(),
          type: k.type ?? parsed.type ?? "primary",
          volume: k.volume ?? null,
          kd: k.kd ?? null,
          articleAngle: k.articleAngle ?? null,
          priority: k.priority ?? parsed.priority ?? "supporting",
          cluster: k.cluster ?? parsed.cluster ?? null,
          contentTypeTarget: k.contentTypeTarget ?? parsed.contentTypeTarget ?? null,
          status: k.status ?? parsed.status ?? "untargeted",
        });
      });
      const created = await storage.createKeywordsBulk(inserts);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // AI suggest keywords
  app.post("/api/keywords/suggest", requireAuth, async (req, res) => {
    try {
      const existingKeywords = await storage.getKeywords();
      const { cluster } = req.body as { cluster?: string };
      const suggestions = await suggestKeywords(existingKeywords, cluster);
      res.json({ suggestions });
    } catch (err) {
      console.error("Keyword suggest error:", err);
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Update keyword
  app.patch("/api/keywords/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid keyword id" });
    try {
      const partial = strictKeywordSchema.partial().parse(req.body);
      const kw = await storage.updateKeyword(id, partial);
      res.json(kw);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      const msg = (err as Error).message;
      if (msg.includes("not found")) return res.status(404).json({ message: msg });
      res.status(500).json({ message: msg });
    }
  });

  // Delete keyword
  app.delete("/api/keywords/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid keyword id" });
    try {
      await storage.deleteKeyword(id);
      res.json({ message: "Keyword deleted" });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // ── Keyword Batch Generation ──────────────────────────────────────────────────
  interface BatchJobItem {
    keywordId: number;
    keyword: string;
    status: "pending" | "processing" | "done" | "error";
    contentItemId?: string;
    title?: string;
    error?: string;
  }
  interface BatchJob {
    total: number;
    completed: number;
    items: BatchJobItem[];
    startedAt: number;
  }
  const batchJobs = new Map<string, BatchJob>();

  // Build cluster-scoped internal links: published pages in the same keyword cluster.
  // For each linked keyword, we look up the slug from Supabase (UUID IDs) so the AI gets
  // a proper /pages/{slug} URL rather than a raw content ID.
  async function getClusterInternalLinks(
    cluster: string | null
  ): Promise<Array<{ title: string; url: string; keyword: string | null }>> {
    try {
      const clusterKws = cluster ? await storage.getKeywords({ cluster }) : [];
      // Only include keywords that already have a linked article (in progress or published)
      const linked = clusterKws.filter(
        (k) => k.contentItemId && k.contentItemTitle && k.status !== "untargeted"
      );
      if (linked.length === 0) return [];

      // Separate Supabase UUIDs from local integer IDs
      const uuids = linked
        .filter((k) => k.contentItemId && !/^\d+$/.test(k.contentItemId!))
        .map((k) => k.contentItemId!);

      // Fetch slug + title + primary keyword from Supabase for UUID-based articles
      const slugMap = new Map<string, { slug: string; title: string; keyword: string | null }>();
      if (uuids.length > 0) {
        for (const table of ["blog_articles", "landing_pages", "lead_magnets"]) {
          const { data } = await supabaseClient
            .from(table)
            .select("id, title, slug, focus_keyword")
            .eq("status", "published")
            .in("id", uuids)
            .limit(50);
          if (data) {
            for (const row of data) {
              slugMap.set(row.id, {
                slug: row.slug || row.id,
                title: row.title || "",
                keyword: row.focus_keyword || null,
              });
            }
          }
        }
      }

      // Only emit pages we found as published in Supabase (slug-based canonical URLs)
      return linked
        .filter((k) => k.contentItemId && !/^\d+$/.test(k.contentItemId!) && slugMap.has(k.contentItemId!))
        .map((k) => {
          const row = slugMap.get(k.contentItemId!)!;
          return { title: row.title || k.contentItemTitle!, url: `/a/articles/${row.slug}`, keyword: row.keyword || k.keyword };
        });
    } catch {
      return [];
    }
  }

  async function runBatchGeneration(job: BatchJob, authorId: string) {
    const shopifyAvailable = await isShopifyConfigured().catch(() => false);

    for (const item of job.items) {
      item.status = "processing";
      try {
        const kw = await storage.getKeyword(item.keywordId);
        if (!kw) throw new Error("Keyword not found");

        // Mark keyword in_progress immediately when processing starts
        await storage.updateKeyword(kw.id, { status: "in_progress" }).catch(() => null);

        const targetType = kw.contentTypeTarget || "blog_article";

        // Cluster-scoped internal links (pages already created in the same cluster)
        const internalLinks = await getClusterInternalLinks(kw.cluster ?? null);

        // Shopify product context: search by keyword + cluster for relevance
        let shopifyProducts: Array<{ title: string; handle: string; price: string; description: string }> = [];
        if (shopifyAvailable) {
          try {
            const searchQuery = kw.cluster ? `${kw.keyword} ${kw.cluster}` : kw.keyword;
            const result = await fetchProductList(5, searchQuery);
            shopifyProducts = result.items.map((p) => ({
              title: p.title,
              handle: p.handle,
              price: `${p.currencyCode} ${p.price}`,
              description: "",
            }));
          } catch {
            shopifyProducts = [];
          }
        }

        const title = await generateTitle(kw.keyword, targetType, kw.keyword).catch(
          () => `${kw.keyword.charAt(0).toUpperCase() + kw.keyword.slice(1)}: A Complete Guide`
        );

        const { sections } = await generateCompleteArticle({
          title,
          type: targetType,
          primaryKeyword: kw.keyword,
          articleAngle: kw.articleAngle ?? undefined,
          internalLinks,
          shopifyProducts,
        });

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        // Create the content item — keywordId links it back to the source keyword
        const created = await storage.createContentItem({
          title,
          slug,
          type: targetType,
          status: "draft",
          approvalStatus: "pending",
          content: sections as unknown,
          primaryKeyword: kw.keyword,
          keywordId: kw.id,
          authorId,
        });

        const contentId = String(created.id);
        await storage.updateKeyword(kw.id, {
          contentItemId: contentId,
          contentItemTitle: title,
          status: "in_progress",
        });

        item.status = "done";
        item.contentItemId = contentId;
        item.title = title;
      } catch (err) {
        item.status = "error";
        item.error = (err as Error).message;
        console.error(`Batch generation error for keyword ${item.keywordId}:`, err);
      }
      job.completed++;
    }
  }

  app.post("/api/keywords/batch-create", requireAuth, async (req, res) => {
    try {
      // Support both `count` (spec) and legacy `n` field — no default in destructure to avoid masking
      const { n, count: countParam, clusterFilter } = req.body as { n?: number; count?: number; clusterFilter?: string };
      const count = Math.min(Math.max(Math.floor(countParam ?? n ?? 3) || 1, 1), 10);
      const authorId = (req as any).user?.id || "batch-ai";

      const filters: Record<string, string> = { status: "untargeted" };
      if (clusterFilter) filters.cluster = clusterFilter;
      const candidates = await storage.getKeywords(filters);

      // Sort: primary priority first → then by cluster (alphabetical) → then by volume desc
      const picked = candidates
        .sort((a, b) => {
          if (a.priority === "primary" && b.priority !== "primary") return -1;
          if (b.priority === "primary" && a.priority !== "primary") return 1;
          const clusterCmp = (a.cluster ?? "").localeCompare(b.cluster ?? "");
          if (clusterCmp !== 0) return clusterCmp;
          return (b.volume ?? 0) - (a.volume ?? 0);
        })
        .slice(0, count);

      if (picked.length === 0) {
        return res.status(400).json({ message: "No untargeted keywords available" });
      }

      const jobId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const job: BatchJob = {
        total: picked.length,
        completed: 0,
        startedAt: Date.now(),
        items: picked.map((kw) => ({
          keywordId: kw.id,
          keyword: kw.keyword,
          status: "pending",
        })),
      };
      batchJobs.set(jobId, job);

      // Run in background — do not await
      runBatchGeneration(job, authorId).catch((err) =>
        console.error("Batch generation fatal error:", err)
      );

      // Clean up old jobs after 1 hour
      setTimeout(() => batchJobs.delete(jobId), 3_600_000);

      res.json({ jobId, total: picked.length, keywords: picked.map((k) => k.keyword) });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get("/api/keywords/batch-status/:jobId", requireAuth, (req, res) => {
    const job = batchJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found or expired" });
    res.json({
      total: job.total,
      completed: job.completed,
      done: job.completed >= job.total,
      items: job.items,
    });
  });

  // ── Page Recommendation ──────────────────────────────────────────────────────
  // Returns a recommended template type, a draft title, and up to 3 matching templates.
  // Accepts: { keywordId?, keyword?, topic? }
  // If nothing is provided, picks the next "untargeted" keyword from the keywords table.
  app.post("/api/pages/recommend", requireAuth, async (req, res) => {
    try {
      const { keywordId, keyword: keywordText, topic } = req.body;

      let resolvedKeyword: string | null = null;
      let resolvedKeywordId: number | null = null;
      let resolvedKeywordRecord: Awaited<ReturnType<typeof storage.getKeyword>> | null = null;

      if (keywordId) {
        const kw = await storage.getKeyword(parseInt(keywordId, 10));
        if (kw) {
          resolvedKeyword = kw.keyword;
          resolvedKeywordId = kw.id;
          resolvedKeywordRecord = kw;
        }
      } else if (keywordText) {
        resolvedKeyword = keywordText;
      } else if (!topic) {
        // AI Pick for Me — pick next untargeted keyword
        const untargeted = await storage.getKeywords({ status: "untargeted" });
        if (untargeted.length > 0) {
          resolvedKeyword = untargeted[0].keyword;
          resolvedKeywordId = untargeted[0].id;
          resolvedKeywordRecord = untargeted[0];
        }
      }

      const inputText = resolvedKeyword || topic || "";

      // Recommend a template type — prefer stored contentTypeTarget for any resolved keyword,
      // then fall back to text-guessing for free-text topic/keyword inputs.
      let recommendedType = "blog_article";
      if (resolvedKeywordRecord?.contentTypeTarget) {
        recommendedType = resolvedKeywordRecord.contentTypeTarget;
      } else {
        const lower = inputText.toLowerCase();
        if (lower.includes("download") || lower.includes("checklist") || lower.includes("template") || lower.includes("toolkit")) {
          recommendedType = "lead_magnet";
        } else if (lower.includes("buy") || lower.includes("product") || lower.includes("shop") || lower.includes("sale") || lower.includes("offer")) {
          recommendedType = "landing_page";
        }
      }

      // Fetch up to 3 templates matching the recommended type
      const { data: matchingTemplates } = await supabaseClient
        .from("templates")
        .select("id, name, type, description, tags")
        .eq("type", recommendedType)
        .limit(3);

      // Generate a draft title using AI
      let draftTitle = "";
      if (inputText) {
        try {
          draftTitle = await generateTitle(inputText, recommendedType, resolvedKeyword || undefined);
        } catch (e) {
          draftTitle = resolvedKeyword
            ? `${resolvedKeyword.charAt(0).toUpperCase() + resolvedKeyword.slice(1)}: A Complete Guide`
            : topic || "New Content";
        }
      }

      res.json({
        keyword: resolvedKeyword,
        keywordId: resolvedKeywordId,
        recommendedType,
        draftTitle,
        matchingTemplates: matchingTemplates || [],
      });
    } catch (error) {
      res.status(500).json({ message: "Recommendation failed: " + (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
