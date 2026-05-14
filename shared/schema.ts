import { pgTable, text, serial, integer, bigint, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User interface — backed by Supabase Auth + user_metadata
export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  defaultTheme?: string | null;
  backgroundColor?: string | null;
  initials: string;
  role?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InsertUser {
  email: string;
  name: string;
  initials: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  defaultTheme?: string | null;
  backgroundColor?: string | null;
  role?: string | null;
}

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default('idea'),
  approvalStatus: text("approval_status").notNull().default('pending'),
  content: jsonb("content_json"),
  contentHTML: text("content_html"),
  metaDescription: text("meta_description"),
  primaryKeyword: text("primary_keyword"),
  supportingKeywords: text("supporting_keywords"),
  featuredImage: text("featured_image"),
  ogImage: text("og_image"),
  ogTitle: text("og_title"),
  canonicalUrl: text("canonical_url"),
  pageTemplate: text("page_template").default("default"),
  structuredData: jsonb("structured_data"),
  customCss: text("custom_css"),
  redirectFrom: text("redirect_from").array(),
  tags: text("tags").array(),
  scheduledPublishDate: timestamp("scheduled_publish_date"),
  publishedAt: timestamp("published_at"),
  framerCmsId: text("framer_cms_id"),
  templateId: text("template_id"),
  klaviyoTemplateId: text("klaviyo_template_id"),
  klaviyoCampaignId: text("klaviyo_campaign_id"),
  keywordId: integer("keyword_id"), // FK → keywords.id for local email content items
  markdownContent: text("markdown_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  authorId: text("author_id").notNull(),
});

// ─── Block background (applies to any block's row in email renderer) ────────
export interface BlockBackground {
  color?: string;
  imageUrl?: string;
  imageSize?: 'cover' | 'contain';
  fallbackColor?: string;
}

// ─── Block content shapes ──────────────────────────────────────────────────
export interface HeadingBlockContent   { text: string; level?: 2 | 3 | 4 }
export interface ParagraphBlockContent { text: string }
export interface ImageBlockContent     {
  url: string;
  alt?: string;
  caption?: string;
  widthMode?: 'full' | 'px' | 'percent';
  customWidth?: number;
  align?: 'left' | 'center' | 'right';
}
export interface ListBlockContent      { items: string[]; ordered?: boolean }
export interface QuoteBlockContent     { text: string; author?: string }
export interface CtaBlockContent       { text?: string; buttonText?: string; link?: string; style?: string }
export interface DividerBlockContent   { style?: "line" | "space"; spacing?: "small" | "medium" | "large" }
export interface SpacerBlockContent    { height: number }

// Web-only blocks (Tier 2)
export interface HeroBlockContent {
  headline: string;
  subtext?: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaText?: string;
  ctaLink?: string;
}
export interface TwoColumnBlockContent {
  leftBlocks:  Array<{ id: string; type: string; content: Record<string, any>; order: number }>;
  rightBlocks: Array<{ id: string; type: string; content: Record<string, any>; order: number }>;
}
export interface AccordionBlockContent {
  items: Array<{ question: string; answer: string }>;
}
export interface BannerBlockContent {
  text: string;
  style?: 'info' | 'sale' | 'warning';
  link?: string;
  linkText?: string;
}
export interface IconTextRowBlockContent {
  items: Array<{ icon: string; headline: string; body: string }>;
  columns?: 3 | 4;
}
export interface AuthorBioBlockContent {
  name: string;
  avatarUrl?: string;
  bio: string;
  links?: Array<{ label: string; url: string }>;
}
export interface BreadcrumbBlockContent {
  items: Array<{ label: string; url: string }>;
}
export interface RelatedContentBlockContent {
  items: Array<{ title: string; url: string; image?: string; contentType?: string }>;
}

// Email-only blocks (Tier 3)
export interface ProductFeatureBlockContent {
  imageUrl?: string;
  imageAlt?: string;
  name: string;
  description?: string;
  price?: string;
  ctaText?: string;
  ctaLink?: string;
}
export interface ProductRowBlockContent {
  products: Array<{ imageUrl?: string; name: string; price?: string; ctaText?: string; ctaLink?: string }>;
}
export interface PromoCodeBlockContent {
  headline?: string;
  code: string;
  expiry?: string;
  instructions?: string;
}
export interface ReviewBlockContent {
  quote: string;
  author: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  avatarUrl?: string;
}
export interface GifImageBlockContent {
  url: string;
  fallbackUrl?: string;
  alt?: string;
  width?: number;
}
export interface CountdownTimerBlockContent {
  endDatetime: string;
  label?: string;
  style?: 'dark' | 'light';
}
export interface ProgressLoyaltyBlockContent {
  label: string;
  current: number;
  goal: number;
  unit?: string;
  color?: string;
}

// App Block (Tier 5) — registered interactive component hydrated in the browser.
// Only componentName + config are persisted; assetUrl is resolved from the
// server registry at render time and never stored in content.
export interface AppBlockContent {
  componentName: string;
  config: Record<string, string>;
}

// Shopify blocks (Tier 4) — reference a Shopify product/collection ID; live data fetched at render time
export interface ShopifyProductCardBlockContent {
  productId: string;
  ctaText?: string;
  ctaLink?: string;
  showDescription?: boolean;
  showPrice?: boolean;
}
export interface ShopifyProductGridBlockContent {
  collectionId: string;
  itemCount?: number;
  sortOrder?: "default" | "price_asc" | "price_desc" | "title";
}
export interface ShopifyCollectionFeatureBlockContent {
  collectionId: string;
  headline?: string;
  subtext?: string;
  ctaText?: string;
  ctaLink?: string;
  imageUrl?: string;
  style?: "light" | "dark";
}
export interface ShopifyVariantSelectorBlockContent {
  productId: string;
  selectorType?: "colour" | "size" | "all";
  ctaText?: string;
  ctaLink?: string;
}

export type BlockContent =
  | HeadingBlockContent
  | ParagraphBlockContent
  | ImageBlockContent
  | ListBlockContent
  | QuoteBlockContent
  | CtaBlockContent
  | DividerBlockContent
  | SpacerBlockContent
  | HeroBlockContent
  | TwoColumnBlockContent
  | AccordionBlockContent
  | BannerBlockContent
  | IconTextRowBlockContent
  | AuthorBioBlockContent
  | BreadcrumbBlockContent
  | RelatedContentBlockContent
  | ProductFeatureBlockContent
  | ProductRowBlockContent
  | PromoCodeBlockContent
  | ReviewBlockContent
  | GifImageBlockContent
  | CountdownTimerBlockContent
  | ProgressLoyaltyBlockContent
  | ShopifyProductCardBlockContent
  | ShopifyProductGridBlockContent
  | ShopifyCollectionFeatureBlockContent
  | ShopifyVariantSelectorBlockContent
  | AppBlockContent;

export const contentBlocks = pgTable("content_blocks", {
  id: serial("id").primaryKey(),
  contentItemId: integer("content_item_id").references(() => contentItems.id).notNull(),
  type: text("type").notNull(),
  content: jsonb("content").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContentItemSchema = createInsertSchema(contentItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentBlockSchema = createInsertSchema(contentBlocks).omit({
  id: true,
  createdAt: true,
});

export type ContentItemBase = typeof contentItems.$inferSelect;
export interface ContentItem extends ContentItemBase {
  contentType?: string | null;
}
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertContentBlock = z.infer<typeof insertContentBlockSchema>;

// ─── Block Presets ─────────────────────────────────────────────────────────
export const blockPresets = pgTable("block_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  blockType: text("block_type").notNull(),
  channel: text("channel"),
  content: jsonb("content").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBlockPresetSchema = createInsertSchema(blockPresets).omit({ id: true, createdAt: true });
export type BlockPreset = typeof blockPresets.$inferSelect;
export type InsertBlockPreset = z.infer<typeof insertBlockPresetSchema>;

// ─── Brand Context ──────────────────────────────────────────────────────────
export const brandContext = pgTable("brand_context", {
  id: text("id").primaryKey(), // We use a fixed UUID: '00000000-0000-0000-0000-000000000001'
  voiceDocument: text("voice_document"),
  avoidRules: text("avoid_rules").array(),
  alwaysRules: text("always_rules").array(),
  wordsWeUse: text("words_we_use").array(),
  wordsWeAvoid: text("words_we_avoid").array(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrandContextSchema = createInsertSchema(brandContext);
export type BrandContext = typeof brandContext.$inferSelect;
export type InsertBrandContext = z.infer<typeof insertBrandContextSchema>;

// ─── Site Settings ──────────────────────────────────────────────────────────
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  // Logo
  logoUrl: text("logo_url"),
  logoLink: text("logo_link").default("https://welltolddesign.com"),
  // Footer logo (optional override — falls back to logoUrl)
  footerLogoUrl: text("footer_logo_url"),
  // Announcement bar
  announcementText: text("announcement_text").default("<strong>FREE SHIPPING</strong> Orders Over $50"),
  announcementLink: text("announcement_link").default("https://welltolddesign.com"),
  announcementBgColor: text("announcement_bg_color").default("#000000"),
  announcementTextColor: text("announcement_text_color").default("#ffffff"),
  announcementEnabled: boolean("announcement_enabled").default(true),
  // Navigation
  navLinks: jsonb("nav_links").default([]),
  // Branding
  primaryColor: text("primary_color").default("#000000"),
  accentColor: text("accent_color").default("#04a7cd"),
  // Footer
  footerBgColor: text("footer_bg_color").default("#F5F5F5"),
  footerColumns: jsonb("footer_columns").default([]),
  footerAddress: text("footer_address"),
  footerLinks: jsonb("footer_links").default([]),
  footerCopyright: text("footer_copyright").default("© 2026 Well Told. All rights reserved."),
  // Footer announcement banner (sits just above the footer)
  footerAnnouncementEnabled: boolean("footer_announcement_enabled").default(false),
  footerAnnouncementText: text("footer_announcement_text").default(""),
  footerAnnouncementLink: text("footer_announcement_link").default(""),
  footerAnnouncementBgColor: text("footer_announcement_bg_color").default("#f0ebe7"),
  footerAnnouncementTextColor: text("footer_announcement_text_color").default("#000000"),
  socialHandle: text("social_handle").default("@WellToldDesign"),
  socialLinks: jsonb("social_links").default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type InsertSiteSettings = typeof siteSettings.$inferInsert;

// ─── Email Styles ────────────────────────────────────────────────────────────
export const emailStyles = pgTable("email_styles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  logoLink: text("logo_link").default("https://welltolddesign.com"),
  footerAddress: text("footer_address"),
  unsubscribeLink: text("unsubscribe_link").default("{{ unsubscribe_url }}"),
  socialLinks: jsonb("social_links").default([]).$type<Array<{ platform: string; url: string }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmailStyleSchema = createInsertSchema(emailStyles).omit({ id: true, createdAt: true });
export type EmailStyle = typeof emailStyles.$inferSelect;
export type InsertEmailStyle = typeof insertEmailStyleSchema._type;

// ─── Keywords ────────────────────────────────────────────────────────────────
export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  type: text("type").notNull().default("primary"), // primary | secondary
  volume: bigint("volume", { mode: "number" }), // monthly search volume
  kd: integer("kd"), // keyword difficulty 0-100
  cluster: text("cluster"),
  articleAngle: text("article_angle"), // tone/angle direction for AI generation
  priority: text("priority").notNull().default("supporting"), // primary | supporting
  contentTypeTarget: text("content_type_target"), // blog_article | landing_page | lead_magnet
  status: text("status").notNull().default("untargeted"), // untargeted | in_progress | published
  contentItemId: text("content_item_id"), // linked content item (local int id or Supabase UUID)
  contentItemTitle: text("content_item_title"), // cached title of the linked article
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKeywordSchema = createInsertSchema(keywords).omit({ id: true, createdAt: true });
export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;

// ─── Integrations ────────────────────────────────────────────────────────────
export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  credentials: jsonb("credentials").notNull().default({}),
  status: text("status").notNull().default("not_connected"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

// ─── Image Templates ─────────────────────────────────────────────────────────
export const imageTemplates = pgTable("image_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  prompt: text("prompt").notNull(),
  model: text("model").notNull().default("flux-pro/kontext/max/text-to-image"),
  referenceImageUrls: text("reference_image_urls").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertImageTemplateSchema = createInsertSchema(imageTemplates).omit({ id: true, createdAt: true });
export type ImageTemplate = typeof imageTemplates.$inferSelect;
export type InsertImageTemplate = z.infer<typeof insertImageTemplateSchema>;

// ─── Email Snippets ──────────────────────────────────────────────────────────
export const emailSnippets = pgTable("email_snippets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  html: text("html").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailSnippetSchema = createInsertSchema(emailSnippets).omit({ id: true, updatedAt: true });
export type EmailSnippet = typeof emailSnippets.$inferSelect;
export type InsertEmailSnippet = z.infer<typeof insertEmailSnippetSchema>;
