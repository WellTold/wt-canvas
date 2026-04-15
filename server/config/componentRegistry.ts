export interface ComponentSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: string;
  enum?: string[];
}

export interface ComponentJsonSchema {
  type: "object";
  properties: Record<string, ComponentSchemaProperty>;
  required?: string[];
}

export interface ComponentConfig {
  name: string;
  label: string;
  description: string;
  assetUrl: string;
  schema: ComponentJsonSchema;
}

export const COMPONENT_REGISTRY: ComponentConfig[] = [
  {
    name: "coming_soon",
    label: "Coming Soon",
    description: "A placeholder countdown / coming-soon banner that hydrates in the browser.",
    assetUrl: "https://cdn.welltold.design/components/coming-soon.js",
    schema: {
      type: "object",
      properties: {
        headline: {
          type: "string",
          title: "Headline",
          description: "Main heading shown on the coming-soon banner",
          default: "Coming Soon",
        },
        subtext: {
          type: "string",
          title: "Subtext",
          description: "Supporting text beneath the headline",
          default: "",
        },
        launchDate: {
          type: "string",
          title: "Launch Date",
          description: "Target launch date in ISO 8601 format, e.g. 2025-12-31T00:00:00Z",
          default: "",
        },
        backgroundColor: {
          type: "string",
          title: "Background Colour",
          description: "CSS colour value for the banner background",
          default: "#f0ebe7",
        },
      },
      required: [],
    },
  },
  {
    name: "product_personaliser",
    label: "Product Personaliser",
    description: "Interactive component allowing customers to personalise a product (stub — replace with production bundle URL).",
    assetUrl: "https://cdn.welltold.design/components/product-personaliser.js",
    schema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          title: "Shopify Product ID or GID",
          description: "The Shopify product to personalise",
          default: "",
        },
        primaryColour: {
          type: "string",
          title: "Primary Colour",
          description: "CSS colour for the accent / brand colour",
          default: "#1a1a1a",
        },
        allowText: {
          type: "string",
          title: "Allow Text Engraving",
          description: "Whether to show the text engraving option",
          enum: ["yes", "no"],
          default: "yes",
        },
        maxTextLength: {
          type: "string",
          title: "Max Text Length",
          description: "Maximum number of characters for text engraving",
          default: "20",
        },
      },
      required: ["productId"],
    },
  },
];

export function findComponent(name: string): ComponentConfig | undefined {
  return COMPONENT_REGISTRY.find((c) => c.name === name);
}

// ── Known block type registry ─────────────────────────────────────────────────
// SOURCE OF TRUTH for all recognised block types across the renderer stack.
// When adding new block types, update this list AND:
//   - client/src/components/content/ContentBlock.tsx  (editor UI + renderBlockEditor switch)
//   - client/src/components/content/ContentEditor.tsx (defaultContent map + block picker)
//   - server/renderer/blockToHtml.ts                  (renderBlock switch)
//   - worker/src/renderer/blockToHtml.ts              (renderBlock switch)
export const KNOWN_BLOCK_TYPES = [
  // Core
  "heading", "text", "paragraph", "image", "quote", "list", "cta", "divider", "spacer", "html_block",
  // Web-only (Tier 2)
  "hero", "two_column", "accordion", "banner", "icon_text_row", "author_bio", "breadcrumb", "related_content",
  // Email-only (Tier 3)
  "product_feature", "product_row", "promo_code", "review", "gif_image", "countdown_timer", "progress_loyalty",
  // Shopify (Tier 4)
  "shopify_product_card", "shopify_product_grid", "shopify_collection_feature",
  "shopify_variant_selector", "shopify_page", "shopify_image",
  // Interactive app blocks
  "app_block",
] as const;

export type KnownBlockType = typeof KNOWN_BLOCK_TYPES[number];
