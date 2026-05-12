/**
 * PRODUCT CATALOG
 * ───────────────
 * Maps gift-buying occasions and article topics to specific Shopify handles,
 * collections, and pages. When an article title or primary keyword matches an
 * entry's `match` phrases, the AI receives those exact resources as context.
 *
 * DATA SOURCES
 * ────────────
 * • Handles verified against Matrixify full-export (May 2026)
 * • Product priority ordered by 12-month net units sold (May 2025 – May 2026)
 * • GFG / Goody products excluded (all unpublished B2B customer items)
 * • Only Active + Published products are referenced
 *
 * MATCHING RULES
 * ──────────────
 * - Case-insensitive substring match on article title + primary keyword combined.
 * - First matching entry wins — ORDER MATTERS. Put specific entries before
 *   general ones (e.g. "Acadia" before "national parks" general).
 * - No match → falls back to live Shopify keyword search.
 *
 * HOW TO ADD AN ENTRY
 * ───────────────────
 * 1. Verify handles: Shopify Admin → Products → URL last segment.
 * 2. Verify collection handles: Shopify Admin → Collections → URL last segment.
 * 3. Verify page handles: Online Store → Pages → URL last segment.
 * 4. Add or extend a CatalogEntry below and restart the app.
 *
 * FIELD GUIDE
 * ───────────
 * handles     → individual products (fetched with real prices + images)
 * collections → "see more" collection links passed to AI
 * pages       → supplementary Shopify CMS page links passed to AI
 *
 * PRODUCT SALES REFERENCE (12-month units, May 2025 – May 2026)
 * ──────────────────────────────────────────────────────────────
 * Home Town Map Rocks Glass              8,328  ← #1 hero product
 * Home Town Map Stemless Wine Glass      3,392
 * Home Town Map Pint Glass               3,353
 * Home Town Map 20 oz Insulated Tumbler  2,206
 * Custom Quote Glassware                 1,921
 * Anywhere Map Rocks Glass               1,264
 * Recipient's City Map Rocks Glass       1,018
 * Custom Night Sky Rocks Glass             448
 * Topography Maps Rocks Glass              292
 * Marathon Map 20 oz Insulated Tumbler     234
 * Literature Rocks Glass                   236
 * World Map Coffee Mug                     263
 */

export interface CatalogEntry {
  label: string;
  match: string[];
  handles: string[];
  collections?: string[];
  pages?: string[];
}

export const PRODUCT_CATALOG: CatalogEntry[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIFIC NATIONAL PARKS — must come before the general "national parks"
  // entry so the more specific match fires first.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "National Park - Acadia",
    match: [
      "acadia", "acadia national park", "bar harbor", "acadia park gift",
      "gifts for nature lovers in maine", "acadia maine",
    ],
    handles: [
      "acadia-rocks",
      "acadia-pint",
      "acadia-stemless-wine",
      "acadia-15oz-ceramic-mug",
      "acadia-21oz-insulated-hydration-bottle",
      "acadia-32-oz-insulated-hydration-bottle",
      "acadia-fleece-blanket",
      "acadia-20oz-insulated-tumbler",
      "acadia-16-oz-insulated-tumbler",
      "acadia-12oz-insulated-wine-tumbler",
    ],
    collections: ["national-park-gifts-acadia", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Yellowstone",
    match: [
      "yellowstone", "yellowstone national park", "yellowstone gift",
    ],
    handles: [
      "yellowstone-rocks",
      "yellowstone-pint",
      "yellowstone-stemless-wine",
      "yellowstone-15oz-ceramic-mug",
      "yellowstone-21oz-insulated-hydration-bottle",
      "yellowstone-fleece-blanket",
      "yellowstone-32-oz-insulated-hydration-bottle",
      "yellowstone-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-yellowstone", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Grand Canyon",
    match: [
      "grand canyon", "grand canyon national park", "grand canyon gift",
    ],
    handles: [
      "grand-canyon-rocks",
      "grand-canyon-pint",
      "grand-canyon-stemless-wine",
      "grand-canyon-15oz-ceramic-mug",
      "grand-canyon-21oz-insulated-hydration-bottle",
      "grand-canyon-fleece-blanket",
      "grand-canyon-32-oz-insulated-hydration-bottle",
      "grand-canyon-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-grand-canyon", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Yosemite",
    match: [
      "yosemite", "yosemite national park", "yosemite gift",
    ],
    handles: [
      "yosemite-rocks",
      "yosemite-pint",
      "yosemite-stemless-wine",
      "yosemite-15oz-ceramic-mug",
      "yosemite-21oz-insulated-hydration-bottle",
      "yosemite-fleece-blanket",
      "yosemite-32-oz-insulated-hydration-bottle",
      "yosemite-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-yosemite", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Great Smoky Mountains",
    match: [
      "great smoky mountains", "smoky mountains", "smoky mountain gift",
      "great smokies",
    ],
    handles: [
      "great-smoky-mountains-rocks",
      "great-smoky-mountains-pint",
      "great-smoky-mountains-stemless-wine",
      "great-smoky-mountains-15oz-ceramic-mug",
      "great-smoky-mountains-21oz-insulated-hydration-bottle",
      "great-smoky-mountains-fleece-blanket",
    ],
    collections: ["national-park-gifts-great-smoky-mountains", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Zion",
    match: [
      "zion national park", "zion park gift", "zion gift",
    ],
    handles: [
      "zion-rocks",
      "zion-pint",
      "zion-stemless-wine",
      "zion-21oz-insulated-hydration-bottle",
      "zion-fleece-blanket",
      "zion-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-zion", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Rocky Mountain",
    match: [
      "rocky mountain national park", "rocky mountain park gift",
    ],
    handles: [
      "rocky-mountain-rocks",
      "rocky-mountain-pint",
      "rocky-mountain-stemless-wine",
      "rocky-mountain-21oz-insulated-hydration-bottle",
      "rocky-mountain-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-rocky-mountain", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Arches",
    match: [
      "arches national park", "arches park gift",
    ],
    handles: [
      "arches-rocks",
      "arches-pint",
      "arches-stemless-wine",
      "arches-21oz-insulated-hydration-bottle",
      "arches-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-arches", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Grand Teton",
    match: [
      "grand teton", "grand teton national park", "grand teton gift",
    ],
    handles: [
      "grand-teton-rocks",
      "grand-teton-pint",
      "grand-teton-stemless-wine",
      "grand-teton-21oz-insulated-hydration-bottle",
      "grand-teton-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-grand-teton", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Joshua Tree",
    match: [
      "joshua tree", "joshua tree national park", "joshua tree gift",
    ],
    handles: [
      "joshua-tree-rocks",
      "joshua-tree-pint",
      "joshua-tree-stemless-wine",
      "joshua-tree-21oz-insulated-hydration-bottle",
      "joshua-tree-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-joshua-tree", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Glacier",
    match: [
      "glacier national park", "glacier park gift",
    ],
    handles: [
      "glacier-rocks",
      "glacier-pint",
      "glacier-stemless-wine",
      "glacier-21oz-insulated-hydration-bottle",
      "glacier-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-glacier", "national-parks"],
    pages: ["gift-guide"],
  },

  {
    label: "National Park - Olympic",
    match: [
      "olympic national park", "olympic park gift",
    ],
    handles: [
      "olympic-rocks",
      "olympic-pint",
      "olympic-stemless-wine",
      "olympic-21oz-insulated-hydration-bottle",
      "olympic-20oz-insulated-tumbler",
    ],
    collections: ["national-park-gifts-olympic", "national-parks"],
    pages: ["gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WINE REGIONS — specific before general "wine lover"
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Wine Region - Napa Valley",
    match: [
      "napa valley", "napa wine", "gifts for napa", "napa valley wine region",
    ],
    handles: [
      "napa-valley-region-map-stemless-wine-glass",
      "napa-valley-region-map-stemmed-wine-glass",
      "napa-valley-region-map-crystal-stemless-wine-glass",
      "napa-valley-region-map-riedel-crystal-stemmed-wine-glass",
      "home-town-maps-rocks-glass",
    ],
    collections: ["napa-valley-wine-region", "wine-regions", "gifts-for-wine-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Wine Region - Sonoma Valley",
    match: [
      "sonoma valley", "sonoma wine", "gifts for sonoma",
    ],
    handles: [
      "sonoma-valley-region-map-stemless-wine-glass",
      "sonoma-valley-region-map-stemmed-wine-glass",
      "sonoma-valley-region-map-crystal-stemless-wine-glass",
      "sonoma-valley-region-map-riedel-crystal-stemmed-wine-glass",
    ],
    collections: ["sonoma-valley-wine-region", "wine-regions", "gifts-for-wine-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Wine Region - Willamette Valley",
    match: [
      "willamette valley", "willamette wine", "oregon wine region",
    ],
    handles: [
      "willamette-valley-region-map-stemless-wine-glass",
      "willamette-valley-region-map-stemmed-wine-glass",
      "willamette-valley-region-map-crystal-stemless-wine-glass",
    ],
    collections: ["willamette-valley-wine-region", "wine-regions", "gifts-for-wine-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Wine Region - Tuscany",
    match: [
      "tuscany wine", "tuscany wine region", "gifts for tuscany",
    ],
    handles: [
      "tuscany-region-map-stemless-wine-glass",
      "tuscany-region-map-stemmed-wine-glass",
      "tuscany-region-map-crystal-stemless-wine-glass",
      "tuscany-region-map-riedel-crystal-stemmed-wine-glass",
    ],
    collections: ["tuscany-wine-region", "wine-regions", "gifts-for-wine-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Wine Region - Bordeaux",
    match: [
      "bordeaux wine", "bordeaux wine region",
    ],
    handles: [
      "bordeaux-region-map-stemless-wine-glass",
      "bordeaux-region-map-stemmed-wine-glass",
      "bordeaux-region-map-crystal-stemless-wine-glass",
    ],
    collections: ["bordeaux-wine-region", "wine-regions", "gifts-for-wine-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Wine Region - Burgundy",
    match: [
      "burgundy wine", "burgundy wine region",
    ],
    handles: [
      "burgundy-region-map-stemless-wine-glass",
      "burgundy-region-map-stemmed-wine-glass",
      "burgundy-region-map-crystal-stemless-wine-glass",
    ],
    collections: ["burgundy-wine-region", "wine-regions", "gifts-for-wine-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Wine Region - Santa Barbara",
    match: [
      "santa barbara wine", "santa barbara wine region",
    ],
    handles: [
      "santa-barbara-region-map-stemless-wine-glass",
      "santa-barbara-region-map-stemmed-wine-glass",
      "santa-barbara-region-map-crystal-stemless-wine-glass",
    ],
    collections: ["santa-barbara-wine-region", "wine-regions", "gifts-for-wine-lovers"],
    pages: ["gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARATHON / RUNNING — specific race cities before general "runner"
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Marathon - Boston",
    match: [
      "boston marathon", "boston 26.2", "gifts for boston runner",
    ],
    handles: [
      "boston-26-marathon-map-rocks",
      "boston-26-marathon-map-pint",
      "boston-26-2-marathon-map-stemless-wine-glass",
      "marathon-map-20oz-insulated-pint-tumbler",
      "home-town-maps-rocks-glass",
    ],
    collections: ["marathon-maps-glassware", "boston"],
    pages: ["gift-guide"],
  },

  {
    label: "Marathon - New York City",
    match: [
      "new york marathon", "nyc marathon", "new york city marathon", "nyc 26.2",
    ],
    handles: [
      "new-york-26-2-marathon-map-rocks",
      "new-york-26-2-marathon-map-pint",
      "new-york-city-26-2-marathon-map-stemless-wine-glass",
      "marathon-map-20oz-insulated-pint-tumbler",
    ],
    collections: ["marathon-maps-glassware", "new-york-city"],
    pages: ["gift-guide"],
  },

  {
    label: "Marathon - Chicago",
    match: [
      "chicago marathon", "chicago 26.2",
    ],
    handles: [
      "chicago-26-2-marathon-map-rocks",
      "chicago-26-2-marathon-map-pint",
      "chicago-26-2-marathon-map-stemless-wine-glass",
      "marathon-map-20oz-insulated-pint-tumbler",
    ],
    collections: ["marathon-maps-glassware", "chicago"],
    pages: ["gift-guide"],
  },

  {
    label: "Marathon - Marine Corps",
    match: [
      "marine corps marathon", "mcm marathon", "marine corps 26.2",
    ],
    handles: [
      "marine-corps-26-2-marathon-map-rocks",
      "marine-corps-26-2-marathon-map-pint",
      "marine-corps-26-2-marathon-map-stemless-wine-glass",
      "marathon-map-20oz-insulated-pint-tumbler",
    ],
    collections: ["marathon-maps-glassware", "washington-dc"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Runners / Marathon",
    match: [
      "runner gift", "running gift", "marathon gift", "gifts for runners",
      "gifts for marathon", "half marathon gift", "5k gift", "10k gift",
      "race day gift", "running milestone", "finisher gift", "26.2",
    ],
    handles: [
      "marathon-map-20oz-insulated-pint-tumbler",
      "marathon-map-stemless-wine-glass",
      "marathon-map-pint",
      "marathon-map-rocks-glass",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "home-town-maps-rocks-glass",
    ],
    collections: ["marathon-maps-glassware", "gifts-for-adventurers"],
    pages: ["gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NIGHT SKY / CONSTELLATION / ASTRONOMY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Constellation Glassware",
    match: [
      "constellation glass", "constellation stemless", "winter sky glass",
      "summer sky glass", "constellation rocks glass",
    ],
    handles: [
      "constellation-rocks-winter-sky-northern-hemisphere",
      "constellation-rocks-summer-sky-northern-hemisphere",
      "constellation-stemless-wine-winter-sky-northern-hemisphere",
      "constellation-stemless-wine-summer-sky-northern-hemisphere",
      "constellation-pint-glass-pair-winter-sky-northern-hemisphere",
      "constellation-pint-summer-sky-northern-hemisphere-set-of-2",
    ],
    collections: ["constellation-glassware", "cosmic-products"],
    pages: ["night-sky-gifts", "night-sky"],
  },

  {
    label: "Night Sky / Astronomy / Star Map Gifts",
    match: [
      "night sky", "astronomy gift", "star gift", "stargazer",
      "gifts for astronomy", "space lover", "astrology gift",
      "star map", "constellation gift", "cosmic gift",
    ],
    handles: [
      "custom-night-sky-rocks-glass",
      "custom-night-sky-stemless-glass",
      "custom-night-sky-pint-glass",
      "custom-night-sky-20oz-insulated-tumbler",
      "custom-night-sky-stemmed-wine-glass",
      "custom-night-sky-stemmed-champagne-flute-pair",
      "custom-night-sky-coffee-mug",
      "custom-night-sky-mason-jar",
      "custom-night-sky-pocket-flask",
      "custom-night-sky-premium-fleece-blanket",
    ],
    collections: ["cosmic-products", "constellation-glassware"],
    pages: ["night-sky-gifts", "night-sky"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORY & LITERATURE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "History / Americana / Founding Fathers",
    match: [
      "founding fathers", "constitution gift", "declaration of independence",
      "americana gift", "patriotic gift", "history buff gift",
      "american history gift", "prohibition", "bill of rights",
      "fourth of july", "4th of july", "independence day", "july 4th",
      "memorial day gift", "patriots day",
    ],
    handles: [
      "founding-fathers-whiskey-glass",
      "constitution-rocks",
      "declaration-rocks",
      "constitution-and-declaration-rocks-glass-pair",
      "constitution-pint-glass",
      "declaration-pint-glass",
      "constitution-ceramic-mug-15oz",
      "join-or-die-ceramic-mug-15oz",
      "us-constitution-20oz-insulated-pint-tumbler",
      "bill-of-rights-20oz-insulated-pint-tumbler",
      "prohibition-amendment-rocks-glass-pair-18th-and-21st-amendment",
    ],
    collections: ["history-and-literature", "history-products", "gifts-for-thinkers"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Book / Literature Lovers",
    match: [
      "book lover", "bookworm", "book gift", "gifts for readers",
      "gifts for book", "literary gift", "literature lover",
      "reader gift", "bibliophile", "gifts for english majors",
    ],
    handles: [
      "literature-rocks-glass",
      "a-tale-of-two-cities-dickens-rocks",
      "a-christmas-carol-dickens-rocks",
      "frankenstein-shelley-rocks",
      "les-miserables-hugo-rocks",
      "hamlet-shakespeare-rocks",
      "pride-and-prejudice-austen-rocks",
      "dracula-stoker-rocks",
      "moby-dick-melville-rocks",
      "sherlock-holmes-conan-doyle-rocks",
      "jane-eyre-bronte-rocks",
      "home-town-maps-coffee-mug",
      "home-town-maps-ceramic-mug",
    ],
    collections: ["literature", "history-and-literature", "gifts-for-thinkers"],
    pages: ["gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ISLAND / BEACH / COASTAL
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Island / Beach / Coastal Gifts",
    match: [
      "island gift", "beach gift", "coastal gift", "gifts for beach",
      "island maps", "beach lover", "gifts for beach bums", "tropical gift",
      "nantucket gift", "martha's vineyard", "hawaii gift", "bahamas gift",
    ],
    handles: [
      "hawaiian-islands-rocks",
      "hawaiian-islands-stemless-wine",
      "nantucket-island-rocks",
      "marthas-vineyard-island-rocks",
      "marthas-vineyard-islands-stemless-wine",
      "bahamas-islands-rocks",
      "bermuda-island-rocks",
      "fiji-islands-rocks",
      "florida-keys-rocks",
      "block-island-rocks",
      "st-thomas-st-john-islands-rocks",
      "home-town-maps-rocks-glass",
    ],
    collections: ["islands", "beach-and-island-inspired-products", "gifts-for-beach-bums"],
    pages: ["gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AVIATION / AIRPORT
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Aviation / Airport / Pilot Gifts",
    match: [
      "aviation gift", "pilot gift", "airport gift", "gifts for pilots",
      "gifts for flight attendants", "aviation enthusiast", "airport map",
      "airports and runways",
    ],
    handles: [
      "bos-boston-airports-and-runways-rocks-glass",
      "jfk-new-york-airports-and-runways-rocks-glass",
      "ord-chicago-o-hare-airports-and-runways-rocks-glass",
      "lax-los-angeles-airports-and-runways-rocks-glass",
      "sfo-san-francisco-airports-and-runways-rocks-glass",
      "atl-atlanta-airports-and-runways-rocks-glass",
      "den-denver-airports-and-runways-rocks-glass",
      "sea-seattle-tacoma-airports-and-runways-rocks-glass",
      "dfw-dallas-fort-worth-airports-and-runways-rocks-glass",
      "mia-miami-airports-and-runways-rocks-glass",
    ],
    collections: ["airports-runways"],
    pages: ["gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOPOGRAPHY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Topography / Landscape / Mountain Gifts",
    match: [
      "topography", "topo map", "landscape gift", "mountain gift",
      "elevation gift", "terrain gift", "topo glass",
    ],
    handles: [
      "topography-maps-rocks-glass",
      "topography-maps-stemless-wine-glass",
      "topography-maps-pint-glass",
      "topo-map-20-oz-insulated-tumbler",
      "topography-maps-32-oz-insulated-hydration-bottle",
      "topography-maps-pocket-flask",
      "topography-maps-coffee-mug",
      "topography-map-cork-coaster-pair",
      "topography-map-blanket",
      "topography-maps-riedel-crystal-rocks-glass",
    ],
    collections: ["topography-glassware", "topography-drinkware"],
    pages: ["world-topography", "gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLEGE / UNIVERSITY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "College Town / University Gifts",
    match: [
      "college gift", "university gift", "gifts for college students",
      "college town gift", "alumni gift", "school spirit gift",
      "gameday gift",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-pint-glass",
      "home-town-maps-stemless-wine-glass",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "anywhere-maps-rocks-glass",
    ],
    collections: ["licensed-college-map-drinkware", "home-town-maps-barware"],
    pages: ["gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GIFTING OCCASIONS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Gifts for Mom / Mother's Day",
    match: [
      "gifts for mom", "gift for mom", "mothers day", "mother's day",
      "mom gift", "gift ideas for mom", "gifts mom",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-ceramic-mug",
      "home-town-maps-coffee-mug",
      "home-town-map-cork-coaster-pair",
      "custom-night-sky-stemless-glass",
      "home-town-maps-12-oz-insulated-wine-tumbler",
      "home-town-map-20-oz-insulated-pint-tumbler",
    ],
    collections: ["home-town-maps-barware", "gifts-for-her"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Dad / Father's Day",
    match: [
      "gifts for dad", "gift for dad", "fathers day", "father's day",
      "dad gift", "gift ideas for dad", "gifts dad",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-pint-glass",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "home-town-map-riedel-crystal-rocks-glass",
      "home-town-map-bar-board",
      "custom-night-sky-rocks-glass",
      "topography-maps-rocks-glass",
      "home-town-maps-pocket-flask",
      "kentucky-bourbon-trail-map-rocks-glass",
    ],
    collections: ["home-town-maps-barware", "gifts-for-him", "gifts-for-whiskey-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Bridesmaid / Bachelorette Gifts",
    match: [
      "bridesmaid gift", "bridesmaids gift", "bachelorette", "bridal party",
      "maid of honor gift", "bride gift", "wedding party gift",
    ],
    handles: [
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-rocks-glass",
      "home-town-maps-stemmed-champagne-flute-pair",
      "home-town-maps-stemmed-wine-glass",
      "custom-quote-glassware",
      "home-town-maps-mason-jar",
      "home-town-maps-12-oz-insulated-wine-tumbler",
      "custom-night-sky-stemmed-champagne-flute-pair",
    ],
    collections: ["home-town-maps-barware", "gifts-for-her", "wedding-gifts-custom"],
    pages: ["gift-guide", "custom-products"],
  },

  {
    label: "Wedding / Anniversary / Couple Gifts",
    match: [
      "wedding gift", "gifts for couples", "couple gift", "anniversary gift",
      "engagement gift", "newlywed", "wedding shower", "first anniversary",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-stemmed-champagne-flute-pair",
      "home-town-map-bar-board",
      "anywhere-maps-rocks-glass",
      "home-town-map-cork-coaster-pair",
      "custom-quote-glassware",
      "custom-night-sky-stemmed-champagne-flute-pair",
    ],
    collections: ["home-town-maps-barware", "anniversary-gifts", "wedding-gifts-custom"],
    pages: ["gift-guide", "custom-products"],
  },

  {
    label: "Housewarming Gifts",
    match: [
      "housewarming", "house warming", "new home gift", "new house gift",
      "home gift", "gifts for new home", "moving gift", "first home",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-pint-glass",
      "home-town-map-bar-board",
      "home-town-map-cork-coaster-pair",
      "hometown-map-candle",
      "home-town-maps-serving-board",
      "anywhere-maps-rocks-glass",
      "custom-quote-glassware",
    ],
    collections: ["home-town-maps-barware", "personalized"],
    pages: ["gift-guide"],
  },

  {
    label: "Graduation Gifts",
    match: [
      "graduation gift", "graduate gift", "gifts for graduate",
      "grad gift", "class of", "senior gift",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-pint-glass",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "custom-quote-glassware",
      "home-town-maps-stemless-wine-glass",
      "anywhere-maps-rocks-glass",
      "home-town-maps-21-oz-insulated-hydration-bottle",
    ],
    collections: ["home-town-maps-barware", "personalized"],
    pages: ["gift-guide", "custom-products"],
  },

  {
    label: "Retirement Gifts",
    match: [
      "retirement gift", "retiring gift", "gifts for retiree",
      "retirement party", "farewell gift", "gifts for retirement",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-map-bar-board",
      "custom-quote-glassware",
      "home-town-maps-stemless-wine-glass",
      "home-town-map-riedel-crystal-rocks-glass",
      "home-town-maps-serving-board",
      "custom-decanter-gift-set",
      "kentucky-bourbon-trail-map-rocks-glass",
    ],
    collections: ["home-town-maps-barware", "gifts-for-him"],
    pages: ["gift-guide", "custom-products"],
  },

  {
    label: "Teacher Appreciation / End of Year Teacher Gifts",
    match: [
      "teacher gift", "teacher appreciation", "gifts for teacher",
      "end of year teacher", "teacher's day", "educator gift",
    ],
    handles: [
      "home-town-maps-ceramic-mug",
      "home-town-maps-coffee-mug",
      "home-town-maps-rocks-glass",
      "custom-quote-glassware",
      "home-town-maps-stemless-wine-glass",
      "world-map-coffee-mug",
    ],
    collections: ["home-town-maps-barware", "gifts-for-coffee-tea-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Coworker / Office Gifts",
    match: [
      "coworker gift", "office gift", "colleague gift", "work gift",
      "gifts for coworker", "gifts for colleague", "work friend gift",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "custom-quote-glassware",
      "home-town-maps-ceramic-mug",
      "home-town-maps-pint-glass",
      "home-town-maps-stemless-wine-glass",
      "anywhere-maps-rocks-glass",
    ],
    collections: ["home-town-maps-barware", "personalized"],
    pages: ["gift-guide"],
  },

  {
    label: "Corporate / Bulk / Branded Gifts",
    match: [
      "corporate gift", "bulk gift", "employee gift", "client gift",
      "team gift", "business gift", "branded gift", "company gift",
      "promotional gift", "custom logo", "bulk order",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-pint-glass",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "custom-quote-glassware",
      "anywhere-maps-rocks-glass",
      "home-town-map-bar-board",
    ],
    collections: ["home-town-maps-barware", "personalized"],
    pages: ["custom-products", "gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INTEREST / HOBBY OCCASIONS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Gifts for Coffee / Tea Lovers",
    match: [
      "coffee lover", "coffee gift", "gifts for coffee", "coffee enthusiast",
      "coffee mug gift", "tea lover", "gifts for tea", "coffee drinker",
    ],
    handles: [
      "home-town-maps-coffee-mug",
      "home-town-maps-ceramic-mug",
      "world-map-coffee-mug",
      "recipients-city-map-coffee-mug",
      "custom-night-sky-coffee-mug",
      "topography-maps-coffee-mug",
    ],
    collections: ["coffee-mugs", "gifts-for-coffee-tea-lovers"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Wine Lovers",
    match: [
      "wine lover", "wine gift", "gifts for wine", "wine enthusiast",
      "wine drinker", "wine glass gift", "gifts for wino",
    ],
    handles: [
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-rocks-glass",
      "home-town-map-crystal-stemless-wine-glass",
      "home-town-maps-stemmed-wine-glass",
      "home-town-maps-12-oz-insulated-wine-tumbler",
      "anywhere-maps-stemless-wine-glass",
      "custom-night-sky-stemless-glass",
      "topography-maps-stemless-wine-glass",
    ],
    collections: ["gifts-for-wine-lovers", "wine-glasses", "wine-regions"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Beer Lovers",
    match: [
      "beer lover", "beer gift", "gifts for beer", "craft beer",
      "beer drinker", "beer enthusiast", "craft beer lover",
      "gifts for craft beer",
    ],
    handles: [
      "home-town-maps-pint-glass",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "home-town-map-16-oz-can-glass",
      "hometown-insulated-16oz-tall-can-cooler",
      "anywhere-maps-pint-glass",
      "home-town-maps-rocks-glass",
    ],
    collections: ["gifts-for-beer-lovers", "pint-glasses"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Bourbon / Whiskey Lovers",
    match: [
      "bourbon lover", "whiskey lover", "whiskey gift", "bourbon gift",
      "gifts for whiskey", "gifts for bourbon", "whiskey enthusiast",
      "scotch lover", "whiskey drinker", "kentucky bourbon",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-map-riedel-crystal-rocks-glass",
      "kentucky-bourbon-trail-map-rocks-glass",
      "custom-decanter-gift-set",
      "founding-fathers-whiskey-glass",
      "custom-quote-glassware",
      "topography-maps-rocks-glass",
    ],
    collections: ["gifts-for-whiskey-lovers", "rocks-glasses"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Outdoor / Hiking / Adventure Lovers",
    match: [
      "outdoor gift", "gifts for hikers", "hiking gift", "adventurer gift",
      "gifts for outdoors", "camper gift", "camping gift", "nature lover",
      "gifts for outdoorsy", "backpacker gift", "wilderness gift",
    ],
    handles: [
      "home-town-maps-21-oz-insulated-hydration-bottle",
      "hometown-maps-32-oz-insulated-hydration-bottle",
      "anywhere-maps-bottle-21-oz",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "topography-maps-32-oz-insulated-hydration-bottle",
      "hometown-16-oz-insulated-tumbler",
      "topography-maps-rocks-glass",
      "hometown-map-blanket",
    ],
    collections: ["gifts-for-adventurers", "all-outdoor-adventure"],
    pages: ["gift-guide"],
  },

  {
    label: "Gifts for Travelers",
    match: [
      "traveler gift", "gifts for travel", "travel gift", "road trip gift",
      "gifts for travelers", "gifts for wanderers",
      "gifts for someone who loves to travel",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "anywhere-maps-rocks-glass",
      "home-town-maps-21-oz-insulated-hydration-bottle",
      "anywhere-maps-bottle-21-oz",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "home-town-maps-pocket-flask",
      "world-map-rocks-glass",
    ],
    collections: ["home-town-maps-barware", "maps", "all-places-and-maps"],
    pages: ["gift-guide", "us-city-maps"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP / PLACE THEMES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "National Parks — General",
    match: [
      "national park gift", "national park lover", "park gift",
      "gifts for national park", "gifts for park lovers", "national parks",
    ],
    handles: [
      "yellowstone-rocks",
      "grand-canyon-rocks",
      "yosemite-rocks",
      "great-smoky-mountains-rocks",
      "acadia-rocks",
      "zion-rocks",
      "rocky-mountain-rocks",
      "arches-rocks",
      "yellowstone-fleece-blanket",
      "grand-canyon-fleece-blanket",
    ],
    collections: ["national-parks", "national-park-rocks-glasses"],
    pages: ["gift-guide"],
  },

  {
    label: "State Pride / Local Pride / City Gifts",
    match: [
      "state pride", "local gift", "city gift", "hometown gift",
      "gifts for locals", "city pride", "regional gift", "hometown pride",
      "state gift",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "anywhere-maps-rocks-glass",
      "state-map-16oz-stainless-cups",
      "state-map-rocks-glass",
      "state-map-pint-glass",
      "state-cork-coasters",
    ],
    collections: ["state-pride", "city", "all-places-and-maps"],
    pages: ["us-city-maps", "gift-guide"],
  },

  {
    label: "Map / Geography / City Map Gifts",
    match: [
      "map gift", "gifts for map lovers", "geography gift", "city map",
      "map lover", "map glass", "map glassware", "cartography gift",
      "custom map glass",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-pint-glass",
      "home-town-maps-stemless-wine-glass",
      "anywhere-maps-rocks-glass",
      "world-map-coffee-mug",
      "world-map-rocks-glass",
    ],
    collections: ["maps", "city", "maps-barware", "all-places-and-maps"],
    pages: ["us-city-maps", "world-topography", "gift-guide"],
  },

  {
    label: "Personalized / Custom Gifts",
    match: [
      "personalized gift", "custom gift", "engraved gift", "gifts with names",
      "custom glassware", "personalized glassware", "etched gift",
      "meaningful gift", "sentimental gift", "custom quote",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "custom-quote-glassware",
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-pint-glass",
      "anywhere-maps-rocks-glass",
      "custom-night-sky-rocks-glass",
      "home-town-map-riedel-crystal-rocks-glass",
    ],
    collections: ["personalized", "custom", "home-town-maps-barware"],
    pages: ["custom-products", "gift-guide"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEASONAL
  // ═══════════════════════════════════════════════════════════════════════════

  {
    label: "Valentine's Day / Romantic Gifts",
    match: [
      "valentine", "valentine's day", "romantic gift", "love gift",
      "gifts for couples february", "anniversary february",
    ],
    handles: [
      "custom-night-sky-stemmed-champagne-flute-pair",
      "home-town-maps-stemmed-champagne-flute-pair",
      "custom-night-sky-stemless-glass",
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-rocks-glass",
      "custom-quote-glassware",
      "love-letters-interactive-mug",
      "custom-night-sky-rocks-glass",
      "literature-rocks-glass",
      "romeo-and-juliet-shakespeare-rocks",
      "a-midsummer-nights-dream-shakespeare-rocks",
      "the-great-gatsby-fitzgerald-rocks",
      "jane-eyre-bronte-rocks",
    ],
    collections: ["home-town-maps-barware", "cosmic-products", "champagne-flute", "literature"],
    pages: ["gift-guide"],
  },

  {
    label: "Summer / Lake Life Gifts",
    match: [
      "lake life", "lake gift", "gifts for lake", "lake house gift",
      "lake cabin gift", "gifts for lake lovers", "summer gift",
      "summer glassware", "gifts for summer",
    ],
    handles: [
      "lake-life-pint-glass",
      "lake-life-stemless-wine-glass",
      "lake-rocks-glass",
      "lake-tahoe-map-ceramic-mug-15oz",
      "big-bear-lake-map-ceramic-mug-15oz",
      "lake-champlain-map-ceramic-mug-15oz",
      "lake-powell-map-ceramic-mug-15oz",
      "home-town-maps-21-oz-insulated-hydration-bottle",
      "home-town-maps-rocks-glass",
    ],
    collections: ["summer-collection", "beach-and-island-inspired-products"],
    pages: ["gift-guide"],
  },

  {
    label: "Halloween / Spooky Gifts",
    match: [
      "halloween", "halloween gift", "spooky gift", "halloween glassware",
      "halloween drinkware",
    ],
    handles: [
      "halloween-custom-quote-glassware",
      "halloween-custom-quote-candle",
      "fall-holiday-12-oz-insulated-wine-tumbler",
      "custom-quote-glassware",
      "home-town-maps-rocks-glass",
    ],
    collections: ["halloween", "seasonal"],
    pages: ["gift-guide"],
  },

  {
    label: "Fall / Autumn / Thanksgiving Gifts",
    match: [
      "thanksgiving", "fall gift", "autumn gift", "fall season",
      "harvest gift", "thanksgiving gift", "fall glassware",
    ],
    handles: [
      "autumn-20-oz-insulated-pint-tumbler",
      "autumn-12-oz-insulated-wine-tumbler",
      "autumn-coffee-mug",
      "home-town-maps-rocks-glass",
      "home-town-maps-stemless-wine-glass",
      "custom-quote-glassware",
    ],
    collections: ["seasonal", "home-town-maps-barware"],
    pages: ["gift-guide"],
  },

  {
    label: "Christmas / Holiday Gifts",
    match: [
      "christmas gift", "holiday gift", "stocking stuffer", "secret santa",
      "gift guide christmas", "holiday guide", "gifts under",
      "christmas present", "holiday present",
    ],
    handles: [
      "winter-holiday-12-oz-insulated-wine-tumbler",
      "winter-holiday-coffee-mug",
      "holiday-custom-quote-glassware",
      "holiday-custom-quote-candle",
      "sweater-rocks",
      "pine-tree-sweater-rocks",
      "snowflake-sweater-rocks-glass",
      "reindeer-sweater-stemless-wine-glass",
      "pine-tree-sweater-stemless-wine-glass",
      "snowflake-sweater-stemless-wine-glass",
      "sweater-rocks-set-of-2-tree-deer",
      "home-town-maps-rocks-glass",
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-pint-glass",
      "custom-quote-glassware",
      "home-town-map-ornament",
      "home-town-map-20-oz-insulated-pint-tumbler",
      "custom-night-sky-rocks-glass",
      "hometown-map-candle",
      "topography-ornament",
    ],
    collections: ["holiday-collection", "home-town-maps-barware", "holiday-ornaments"],
    pages: ["gift-guide"],
  },

  {
    label: "Give Back / Mission-Driven Gifting",
    match: [
      "give back", "charitable gift", "gifts that give back",
      "social impact gift", "mission driven", "cause gift",
      "conscious gift", "purposeful gift",
    ],
    handles: [
      "home-town-maps-rocks-glass",
      "home-town-maps-stemless-wine-glass",
      "home-town-maps-pint-glass",
      "custom-quote-glassware",
      "home-town-map-20-oz-insulated-pint-tumbler",
    ],
    collections: ["home-town-maps-barware"],
    pages: ["gift-guide"],
  },

];

/**
 * Default entry used when no specific catalog entry matches.
 * Contains the top-selling hero products — ordered by 12-month net units sold.
 * This ensures AI never falls back to a raw Shopify keyword search (which can
 * return blank/template products with no map art).
 */
export const DEFAULT_CATALOG_ENTRY: CatalogEntry = {
  label: "Default Bestsellers",
  match: [],
  handles: [
    "home-town-maps-rocks-glass",
    "home-town-maps-stemless-wine-glass",
    "home-town-maps-pint-glass",
    "home-town-map-20-oz-insulated-pint-tumbler",
    "custom-night-sky-rocks-glass",
    "custom-quote-glassware",
    "topography-maps-rocks-glass",
    "home-town-map-riedel-crystal-rocks-glass",
    "home-town-maps-coffee-mug",
  ],
  collections: ["home-town-maps-barware", "custom"],
  pages: ["gift-guide"],
};

/**
 * Match a title + primary keyword against the catalog.
 * Returns the matched CatalogEntry (handles + collections + pages).
 * Falls back to DEFAULT_CATALOG_ENTRY (hero products) if nothing matches —
 * never returns null, so raw Shopify keyword searches (which can return blank
 * template products) are never used.
 */
export function matchProductCatalog(title: string, primaryKeyword?: string): CatalogEntry {
  const haystack = `${title} ${primaryKeyword ?? ""}`.toLowerCase();
  for (const entry of PRODUCT_CATALOG) {
    if (entry.match.some(term => haystack.includes(term.toLowerCase()))) {
      console.log(`[productCatalog] Matched "${entry.label}" for: "${title}"`);
      return entry;
    }
  }
  console.log(`[productCatalog] No match for: "${title}" — using default bestsellers`);
  return DEFAULT_CATALOG_ENTRY;
}