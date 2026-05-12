/**
 * PRODUCT CATALOG
 * ───────────────
 * Maps gift-buying occasions and article topics to specific Shopify product handles.
 * When an article title or primary keyword matches an entry's `match` phrases, the
 * AI will receive those exact products as its product context — guaranteeing relevance.
 *
 * HOW TO ADD AN ENTRY
 * ───────────────────
 * 1. Find the product handle on Shopify (Admin → Products → the handle is in the URL
 *    or listed under the product title).
 * 2. Add or extend a CatalogEntry below with the keyword patterns you want to match.
 * 3. List handles in order of preference — the AI will use the first 5–8.
 * 4. Redeploy the app for changes to take effect.
 *
 * MATCHING RULES
 * ──────────────
 * - Matching is case-insensitive and looks for any `match` phrase appearing anywhere
 *   in the article title OR primary keyword.
 * - The first catalog entry that matches wins; order matters.
 * - If no catalog entry matches, the system falls back to a live Shopify keyword search.
 */

export interface CatalogEntry {
  /** Human-readable label for this occasion — not used in matching. */
  label: string;
  /** Phrases to match against article title + primary keyword (case-insensitive substring). */
  match: string[];
  /** Shopify product handles to fetch, in priority order. */
  handles: string[];
}

export const PRODUCT_CATALOG: CatalogEntry[] = [

  // ─── GIFTING FOR MOM ──────────────────────────────────────────────────────
  {
    label: "Gifts for Mom / Mother's Day",
    match: [
      "gifts for mom", "gift for mom", "mothers day", "mother's day",
      "gifts mom", "mom gift", "gift ideas for mom",
    ],
    handles: [
      "acadia-stemless-wine",
      "acadia-12oz-insulated-wine-tumbler",
      "acadia-fleece-blanket",
      "acadia-15oz-ceramic-mug",
      "acadia-rocks",
      "acadia-pint",
      "12-oz-insulated-wine-tumbler",
    ],
  },

  // ─── GIFTING FOR DAD ──────────────────────────────────────────────────────
  {
    label: "Gifts for Dad / Father's Day",
    match: [
      "gifts for dad", "gift for dad", "fathers day", "father's day",
      "gifts dad", "dad gift", "gift ideas for dad",
    ],
    handles: [
      "acadia-pint",
      "acadia-rocks",
      "acadia-16-oz-insulated-tumbler",
      "acadia-21oz-insulated-hydration-bottle",
      "16-oz-insulated-tumbler",
      "21-oz-insulated-hydration-bottle",
      "acadia-fleece-blanket",
    ],
  },

  // ─── HOUSEWARMING ─────────────────────────────────────────────────────────
  {
    label: "Housewarming Gifts",
    match: [
      "housewarming", "house warming", "new home gift", "new house gift",
      "home gift", "gifts for new home", "moving gift",
    ],
    handles: [
      "acadia-stemless-wine",
      "acadia-rocks",
      "acadia-pint",
      "acadia-fleece-blanket",
      "acadia-15oz-ceramic-mug",
      "acadia-12oz-insulated-wine-tumbler",
    ],
  },

  // ─── OUTDOOR / HIKER / ADVENTURER ─────────────────────────────────────────
  {
    label: "Outdoor / Hiking / Adventure Gifts",
    match: [
      "outdoor gift", "gifts for hikers", "hiking gift", "adventurer",
      "gifts for outdoors", "camper gift", "camping gift", "nature lover",
      "gifts for nature", "gifts for outdoorsy",
    ],
    handles: [
      "acadia-21oz-insulated-hydration-bottle",
      "acadia-32-oz-insulated-hydration-bottle",
      "acadia-16-oz-insulated-tumbler",
      "21-oz-insulated-hydration-bottle",
      "32-oz-insulated-hydration-bottle",
      "acadia-fleece-blanket",
      "acadia-insulated-16oz-tall-can-cooler",
    ],
  },

  // ─── WEDDING / COUPLE ─────────────────────────────────────────────────────
  {
    label: "Wedding / Couple Gifts",
    match: [
      "wedding gift", "gifts for couples", "couple gift", "bridal gift",
      "engagement gift", "anniversary gift", "newlywed",
    ],
    handles: [
      "acadia-stemless-wine",
      "acadia-pint",
      "acadia-rocks",
      "acadia-12oz-insulated-wine-tumbler",
      "acadia-fleece-blanket",
      "acadia-15oz-ceramic-mug",
    ],
  },

  // ─── CHRISTMAS / HOLIDAY ──────────────────────────────────────────────────
  {
    label: "Christmas / Holiday Gifts",
    match: [
      "christmas gift", "holiday gift", "stocking stuffer", "secret santa",
      "gift guide christmas", "holiday guide", "gifts under",
    ],
    handles: [
      "a-christmas-carol-dickens-rocks",
      "acadia-stemless-wine",
      "acadia-12oz-insulated-wine-tumbler",
      "acadia-fleece-blanket",
      "acadia-rocks",
      "acadia-pint",
      "acadia-15oz-ceramic-mug",
    ],
  },

  // ─── WINE LOVER ───────────────────────────────────────────────────────────
  {
    label: "Gifts for Wine Lovers",
    match: [
      "wine lover", "wine gift", "gifts for wine", "wine enthusiast",
      "wine drinker",
    ],
    handles: [
      "acadia-stemless-wine",
      "acadia-12oz-insulated-wine-tumbler",
      "12-oz-insulated-wine-tumbler",
      "acadia-rocks",
      "acadia-pint",
    ],
  },

  // ─── BEER LOVER ───────────────────────────────────────────────────────────
  {
    label: "Gifts for Beer Lovers",
    match: [
      "beer lover", "beer gift", "gifts for beer", "craft beer",
      "beer drinker", "beer enthusiast",
    ],
    handles: [
      "acadia-pint",
      "acadia-16-oz-insulated-tumbler",
      "acadia-insulated-16oz-tall-can-cooler",
      "16-oz-insulated-tumbler",
      "16oz-tall-can-cooler-ice-puck-adapter",
      "6-pack-stainless-cups-16oz-well-told-brand",
    ],
  },

  // ─── TRAVELER ─────────────────────────────────────────────────────────────
  {
    label: "Gifts for Travelers",
    match: [
      "traveler gift", "gifts for travel", "travel gift", "road trip gift",
      "gifts for travelers", "gifts for wanderers",
    ],
    handles: [
      "acadia-21oz-insulated-hydration-bottle",
      "acadia-16-oz-insulated-tumbler",
      "acadia-12-oz-insulated-can-cooler",
      "21-oz-insulated-hydration-bottle",
      "acadia-rocks",
      "acadia-fleece-blanket",
    ],
  },

  // ─── BOOK LOVER ───────────────────────────────────────────────────────────
  {
    label: "Gifts for Book Lovers",
    match: [
      "book lover", "bookworm", "book gift", "gifts for readers",
      "gifts for book", "literary gift",
    ],
    handles: [
      "a-christmas-carol-dickens-rocks",
      "a-tale-of-two-cities-dickens-rocks",
      "a-christmas-carol-and-other-writings",
      "acadia-15oz-ceramic-mug",
      "acadia-stemless-wine",
    ],
  },

  // ─── NATIONAL PARKS ───────────────────────────────────────────────────────
  {
    label: "National Parks / Acadia",
    match: [
      "national park", "acadia", "park gift", "gifts for park",
    ],
    handles: [
      "acadia-rocks",
      "acadia-pint",
      "acadia-stemless-wine",
      "acadia-12oz-insulated-wine-tumbler",
      "acadia-fleece-blanket",
      "acadia-15oz-ceramic-mug",
      "acadia-21oz-insulated-hydration-bottle",
    ],
  },

  // ─── CORPORATE / BULK ─────────────────────────────────────────────────────
  {
    label: "Corporate / Bulk Gifts",
    match: [
      "corporate gift", "bulk gift", "employee gift", "client gift",
      "team gift", "office gift", "business gift", "branded gift",
    ],
    handles: [
      "acadia-pint",
      "acadia-16-oz-insulated-tumbler",
      "acadia-rocks",
      "6-pack-stainless-cups-16oz-well-told-brand",
      "8-pack-stainless-cups-16oz-well-told-brand",
      "acadia-12oz-insulated-wine-tumbler",
    ],
  },

];

/**
 * Match a title + primary keyword against the catalog.
 * Returns the curated product handles for the first matching entry,
 * or null if no entry matches (caller should fall back to Shopify search).
 */
export function matchProductCatalog(title: string, primaryKeyword?: string): string[] | null {
  const haystack = `${title} ${primaryKeyword ?? ""}`.toLowerCase();
  for (const entry of PRODUCT_CATALOG) {
    if (entry.match.some(term => haystack.includes(term.toLowerCase()))) {
      console.log(`[productCatalog] Matched "${entry.label}" for: "${title}"`);
      return entry.handles;
    }
  }
  return null;
}
