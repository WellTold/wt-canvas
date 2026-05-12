/**
 * PRODUCT CATALOG
 * ───────────────
 * Maps gift-buying occasions and article topics to specific Shopify handles,
 * collections, and pages. When an article title or primary keyword matches an
 * entry's `match` phrases, the AI receives those exact resources as context.
 *
 * HOW TO ADD AN ENTRY
 * ───────────────────
 * 1. Find handles in Shopify Admin → Products (handle = last segment of URL).
 * 2. Find collection handles in Shopify Admin → Collections.
 * 3. Find page handles in Shopify Admin → Online Store → Pages.
 * 4. Add or extend a CatalogEntry below.
 * 5. Restart the app for changes to take effect.
 *
 * FIELD GUIDE
 * ───────────
 * handles     → individual products, fetched with real prices + images
 * collections → collection pages (e.g. /collections/map-glasses) — passed to AI as "see more" links
 * pages       → Shopify CMS pages (e.g. /pages/gift-guide) — passed to AI as supplementary links
 *
 * MATCHING RULES
 * ──────────────
 * - Case-insensitive substring match on article title + primary keyword combined.
 * - First matching entry wins — order matters.
 * - No match → falls back to live Shopify keyword search.
 */

export interface CatalogEntry {
  label: string;
  match: string[];
  handles: string[];
  collections?: string[];
  pages?: string[];
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
    collections: [
      "all",
    ],
    pages: [
      "gift-guide",
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
    collections: [
      "all",
    ],
    pages: [
      "gift-guide",
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
    collections: [
      "all",
    ],
    pages: [
      "gift-guide",
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
    collections: [
      "all",
    ],
    pages: [
      "gift-guide",
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
    collections: [
      "all",
    ],
    pages: [
      "gift-guide",
      "custom-products",
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
    collections: [
      "all",
    ],
    pages: [
      "gift-guide",
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
    collections: [
      "all",
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
    collections: [
      "all",
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
    collections: [
      "all",
    ],
    pages: [
      "us-city-maps",
      "world-topography",
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
    collections: [
      "all",
    ],
    pages: [
      "history",
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
    collections: [
      "all",
    ],
  },

  // ─── MAP / GEOGRAPHY LOVER ────────────────────────────────────────────────
  {
    label: "Map / Geography Gifts",
    match: [
      "map gift", "gifts for map lovers", "geography gift", "city map",
      "map lover", "map glass", "map glassware",
    ],
    handles: [
      "acadia-rocks",
      "acadia-pint",
      "acadia-stemless-wine",
      "akron-oh-map-rocks-glass",
    ],
    collections: [
      "map-glasses",
    ],
    pages: [
      "us-city-maps",
      "world-topography",
    ],
  },

  // ─── NIGHT SKY / CONSTELLATION ────────────────────────────────────────────
  {
    label: "Night Sky / Constellation Gifts",
    match: [
      "constellation", "night sky", "astronomy gift", "star gift",
      "stargazer", "gifts for astronomy",
    ],
    handles: [
      "acadia-rocks",
      "acadia-pint",
      "acadia-stemless-wine",
    ],
    collections: [
      "constellation-glasses",
    ],
    pages: [
      "night-sky-gifts",
      "night-sky",
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
    collections: [
      "all",
    ],
    pages: [
      "custom-products",
    ],
  },

];

/**
 * Match a title + primary keyword against the catalog.
 * Returns the full matched CatalogEntry (handles + collections + pages),
 * or null if no entry matches (caller should fall back to Shopify search).
 */
export function matchProductCatalog(title: string, primaryKeyword?: string): CatalogEntry | null {
  const haystack = `${title} ${primaryKeyword ?? ""}`.toLowerCase();
  for (const entry of PRODUCT_CATALOG) {
    if (entry.match.some(term => haystack.includes(term.toLowerCase()))) {
      console.log(`[productCatalog] Matched "${entry.label}" for: "${title}"`);
      return entry;
    }
  }
  return null;
}
