import { resolveCredentials, isLegacy, isAdmin, getStorefrontToken } from "./shopifyTokenManager";

const SHOPIFY_API_VERSION = "2026-01";

interface ShopifyCredentials {
  domain: string;
  token: string;
  useAdmin: boolean;
}

async function getShopifyCredentials(): Promise<ShopifyCredentials | null> {
  const creds = await resolveCredentials();
  if (!creds) return null;

  if (isAdmin(creds)) {
    return { domain: creds.storeDomain, token: creds.adminToken, useAdmin: true };
  }
  if (isLegacy(creds)) {
    // Detect shpat_ in storefront field — route to admin API
    if (creds.storefrontToken.startsWith("shpat_")) {
      return { domain: creds.storeDomain, token: creds.storefrontToken, useAdmin: true };
    }
    return { domain: creds.storeDomain, token: creds.storefrontToken, useAdmin: false };
  }

  // OAuth: exchange client credentials for a Storefront token
  const token = await getStorefrontToken();
  return { domain: creds.storeDomain, token, useAdmin: false };
}

function sanitizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function getEndpointFromCreds(domain: string): string {
  return `https://${sanitizeDomain(domain)}/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

function getAdminRestUrl(domain: string, path: string): string {
  return `https://${sanitizeDomain(domain)}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
}

async function adminRest(path: string, token: string, domain: string): Promise<any> {
  const url = getAdminRestUrl(domain, path);
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Shopify Admin API ${response.status}: ${body}`);
  }
  return response.json();
}

async function gql(query: string, variables: Record<string, any>): Promise<any> {
  const creds = await getShopifyCredentials();
  if (!creds) throw new Error("Shopify is not configured");

  const response = await fetch(getEndpointFromCreds(creds.domain), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": creds.token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Shopify API ${response.status}`);
  const json = (await response.json()) as any;
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

export function toProductGid(id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/Product/${id}`;
}

export function toCollectionGid(id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/Collection/${id}`;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: string;
  currencyCode: string;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    available: boolean;
    options?: Array<{ name: string; value: string }>;
  }>;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  products: Array<{
    id: string;
    title: string;
    handle: string;
    imageUrl: string | null;
    imageAlt: string | null;
    price: string;
    currencyCode: string;
  }>;
}

const PRODUCT_QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id title handle description
      images(first: 1) { nodes { url altText } }
      priceRange { minVariantPrice { amount currencyCode } }
      variants(first: 20) { nodes { id title price { amount } availableForSale selectedOptions { name value } } }
    }
  }
`;

const COLLECTION_QUERY = `
  query GetCollection($id: ID!, $count: Int!) {
    collection(id: $id) {
      id title handle description
      image { url altText }
      products(first: $count) {
        nodes {
          id title handle
          images(first: 1) { nodes { url altText } }
          priceRange { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }
`;

const SHOP_QUERY = `
  query {
    shop {
      name
      primaryDomain { url }
    }
  }
`;

export async function testShopifyConnection(storeDomain: string, token: string): Promise<{ name: string; domain: string }> {
  const cleanDomain = sanitizeDomain(storeDomain);
  const cleanToken = token.trim();
  const useAdmin = cleanToken.startsWith("shpat_");

  if (useAdmin) {
    console.log(`[Shopify] testShopifyConnection (Admin REST) domain=${cleanDomain}, prefix=${cleanToken.slice(0, 12)}...`);
    const json = await adminRest("shop.json", cleanToken, cleanDomain);
    const shop = json?.shop;
    if (!shop) throw new Error("No shop data returned from Admin API");
    return { name: shop.name, domain: shop.domain ?? cleanDomain };
  }

  const endpoint = getEndpointFromCreds(cleanDomain);
  console.log(`[Shopify] testShopifyConnection (Storefront) endpoint=${endpoint}, length=${cleanToken.length}, prefix=${cleanToken.slice(0, 12)}...`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": cleanToken,
    },
    body: JSON.stringify({ query: SHOP_QUERY, variables: {} }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[Shopify] testShopifyConnection failed ${response.status} for domain=${cleanDomain} body=${body}`);
    if (response.status === 401) {
      throw new Error(
        `Shopify Storefront API returned 401. If you have an Admin API access token (shpat_...) use that instead — it works without Storefront API being configured.`
      );
    }
    throw new Error(`Shopify API returned ${response.status}: ${body}`);
  }
  const json = (await response.json()) as any;
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const shop = json.data?.shop;
  if (!shop) throw new Error("No shop data returned");
  return { name: shop.name, domain: shop.primaryDomain?.url ?? storeDomain };
}

export async function isShopifyConfigured(): Promise<boolean> {
  const creds = await getShopifyCredentials();
  return creds !== null;
}

export async function fetchProduct(rawId: string): Promise<ShopifyProduct> {
  const creds = await getShopifyCredentials();
  if (!creds) throw new Error("Shopify is not configured");

  if (creds.useAdmin) {
    const numericId = rawId.replace(/^gid:\/\/shopify\/Product\//, "");
    const json = await adminRest(`products/${numericId}.json`, creds.token, creds.domain);
    const p = json?.product;
    if (!p) throw new Error(`Product not found: ${rawId}`);
    return {
      id: `gid://shopify/Product/${p.id}`,
      title: p.title,
      handle: p.handle || "",
      description: p.body_html?.replace(/<[^>]+>/g, "") ?? "",
      imageUrl: p.images?.[0]?.src ?? null,
      imageAlt: p.images?.[0]?.alt || null,
      price: p.variants?.[0]?.price ?? "0",
      currencyCode: "USD",
      variants: (p.variants ?? []).map((v: any) => ({
        id: `gid://shopify/ProductVariant/${v.id}`,
        title: v.title,
        price: v.price ?? "0",
        available: (v.inventory_quantity ?? 1) > 0,
        options: [],
      })),
    };
  }

  const id = toProductGid(rawId);
  const data = await gql(PRODUCT_QUERY, { id });
  const p = data?.product;
  if (!p) throw new Error(`Product not found: ${rawId}`);
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description || "",
    imageUrl: p.images?.nodes?.[0]?.url ?? null,
    imageAlt: p.images?.nodes?.[0]?.altText ?? null,
    price: p.priceRange?.minVariantPrice?.amount ?? "0",
    currencyCode: p.priceRange?.minVariantPrice?.currencyCode ?? "USD",
    variants: (p.variants?.nodes ?? []).map((v: any) => ({
      id: v.id,
      title: v.title,
      price: v.price?.amount ?? "0",
      available: v.availableForSale ?? false,
      options: (v.selectedOptions ?? []).map((o: any) => ({ name: o.name, value: o.value })),
    })),
  };
}

export interface ShopifyPage {
  id: string;
  title: string;
  handle: string;
  bodySummary: string;
  url: string;
}

export interface ShopifyImage {
  id: string;
  url: string;
  altText: string | null;
  mimeType: string;
}

const PAGES_QUERY = `
  query ListPages($count: Int!) {
    pages(first: $count) {
      nodes { id title handle bodySummary url }
    }
  }
`;

const FILES_QUERY = `
  query ListFiles($count: Int!) {
    files(first: $count, query: "media_type:IMAGE") {
      nodes {
        ... on MediaImage {
          id
          image { url altText }
          mediaContentType
        }
      }
    }
  }
`;

const PRODUCTS_QUERY = `
  query ListProducts($count: Int!, $query: String, $after: String) {
    products(first: $count, query: $query, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id title handle
        images(first: 1) { nodes { url altText } }
        priceRange { minVariantPrice { amount currencyCode } }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query ListCollections($count: Int!, $query: String, $after: String) {
    collections(first: $count, query: $query, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id title handle description
        image { url altText }
      }
    }
  }
`;

export interface ShopifyProductSummary {
  id: string;
  title: string;
  handle: string;
  price: string;
  currencyCode: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface ShopifyCollectionSummary {
  id: string;
  title: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

// Stop words to strip when extracting meaningful search terms from keyword phrases
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can','need',
  'best','top','great','good','great','perfect','ideal','ultimate','complete',
  'how','what','when','where','who','why','which','guide','tips','ideas',
  'most','more','less','very','really','just','only','also','both','all',
  'any','some','no','not','so','as','if','then','than','that','this','these',
  'those','from','into','about','up','out','her','him','his','its','our','your',
  'their','my','me','us','we','you','he','she','they','it',
]);

function extractSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function normaliseProduct(p: any): ShopifyProductSummary {
  return {
    id: `gid://shopify/Product/${p.id}`,
    title: p.title,
    handle: p.handle || '',
    price: p.variants?.[0]?.price ?? '0',
    currencyCode: 'USD',
    imageUrl: p.images?.[0]?.src ?? null,
    imageAlt: p.images?.[0]?.alt || null,
  };
}

async function adminFetchProductsRelevant(
  token: string,
  domain: string,
  count: number,
  query?: string,
): Promise<PaginatedResult<ShopifyProductSummary>> {
  const seen = new Map<string, any>(); // id → raw product object

  if (query) {
    const terms = extractSearchTerms(query);

    if (terms.length > 0) {
      // Run all signal searches in parallel: custom collections, smart collections, tags
      const searches = await Promise.allSettled([
        // Custom collections whose title contains any term
        ...terms.map(t =>
          adminRest(`custom_collections.json?title=${encodeURIComponent(t)}&limit=5`, token, domain)
            .then((j: any) => j?.custom_collections ?? [])
            .catch(() => [])
        ),
        // Smart collections whose title contains any term
        ...terms.map(t =>
          adminRest(`smart_collections.json?title=${encodeURIComponent(t)}&limit=5`, token, domain)
            .then((j: any) => j?.smart_collections ?? [])
            .catch(() => [])
        ),
        // Products tagged with any term
        ...terms.map(t =>
          adminRest(`products.json?tag=${encodeURIComponent(t)}&limit=${count}&status=active`, token, domain)
            .then((j: any) => j?.products ?? [])
            .catch(() => [])
        ),
      ]);

      const taggedProducts: any[] = [];
      const collectionIds = new Set<string>();

      for (const result of searches) {
        if (result.status !== 'fulfilled') continue;
        const items: any[] = result.value;
        for (const item of items) {
          if ('handle' in item && 'variants' in item) {
            // It's a product (from tag search)
            taggedProducts.push(item);
          } else if ('id' in item) {
            // It's a collection
            collectionIds.add(String(item.id));
          }
        }
      }

      // Fetch products from each matched collection (parallel)
      const collectionProductFetches = await Promise.allSettled(
        [...collectionIds].map(id =>
          adminRest(`collections/${id}/products.json?limit=${count}&status=active`, token, domain)
            .then((j: any) => j?.products ?? [])
            .catch(() => [])
        )
      );

      for (const r of collectionProductFetches) {
        if (r.status === 'fulfilled') {
          for (const p of r.value) seen.set(String(p.id), p);
        }
      }
      for (const p of taggedProducts) seen.set(String(p.id), p);
    }
  }

  // Back-fill with recent active products if we don't have enough yet
  if (seen.size < count) {
    const needed = count - seen.size;
    const fallback = await adminRest(
      `products.json?limit=${needed}&status=active`,
      token, domain
    ).catch(() => ({ products: [] }));
    for (const p of (fallback?.products ?? [])) {
      if (!seen.has(String(p.id))) seen.set(String(p.id), p);
    }
  }

  const products = [...seen.values()].slice(0, count);
  console.log(`[Shopify] Admin REST smart fetch → ${products.length} products (query: "${query ?? 'none'}")`);
  return {
    items: products.map(normaliseProduct),
    hasNextPage: false,
    endCursor: null,
  };
}

export async function fetchProductList(
  count = 40,
  query?: string,
  after?: string,
): Promise<PaginatedResult<ShopifyProductSummary>> {
  const safeCount = Math.min(Math.max(count, 1), 40);
  const creds = await getShopifyCredentials();
  if (!creds) throw new Error("Shopify is not configured");

  if (creds.useAdmin) {
    return adminFetchProductsRelevant(creds.token, creds.domain, safeCount, query);
  }

  const data = await gql(PRODUCTS_QUERY, {
    count: safeCount,
    query: query || null,
    after: after || null,
  });
  const pageInfo = data?.products?.pageInfo ?? {};
  const nodes = data?.products?.nodes ?? [];
  return {
    items: nodes.map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle || "",
      price: p.priceRange?.minVariantPrice?.amount ?? "0",
      currencyCode: p.priceRange?.minVariantPrice?.currencyCode ?? "USD",
      imageUrl: p.images?.nodes?.[0]?.url ?? null,
      imageAlt: p.images?.nodes?.[0]?.altText ?? null,
    })),
    hasNextPage: pageInfo.hasNextPage ?? false,
    endCursor: pageInfo.endCursor ?? null,
  };
}

export async function fetchCollectionList(
  count = 40,
  query?: string,
  after?: string,
): Promise<PaginatedResult<ShopifyCollectionSummary>> {
  const safeCount = Math.min(Math.max(count, 1), 40);
  const data = await gql(COLLECTIONS_QUERY, {
    count: safeCount,
    query: query || null,
    after: after || null,
  });
  const pageInfo = data?.collections?.pageInfo ?? {};
  const nodes = data?.collections?.nodes ?? [];
  return {
    items: nodes.map((c: any) => ({
      id: c.id,
      title: c.title,
      handle: c.handle || "",
      description: c.description || "",
      imageUrl: c.image?.url ?? null,
      imageAlt: c.image?.altText ?? null,
    })),
    hasNextPage: pageInfo.hasNextPage ?? false,
    endCursor: pageInfo.endCursor ?? null,
  };
}

export async function fetchPages(count = 20): Promise<ShopifyPage[]> {
  const data = await gql(PAGES_QUERY, { count: Math.min(Math.max(count, 1), 50) });
  const nodes = data?.pages?.nodes ?? [];
  return nodes.map((p: any) => ({
    id: p.id,
    title: p.title,
    handle: p.handle || "",
    bodySummary: p.bodySummary || "",
    url: p.url || `/pages/${p.handle}`,
  }));
}

const METAOBJECTS_IMAGES_QUERY = `
  query ListMediaMetaobjects($count: Int!) {
    metaobjects(type: "image", first: $count) {
      nodes {
        id
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url altText }
            }
          }
        }
      }
    }
  }
`;

export async function fetchImages(count = 20): Promise<ShopifyImage[]> {
  const safeCount = Math.min(Math.max(count, 1), 50);
  // Primary: Storefront files query (available on stores with Files access)
  try {
    const data = await gql(FILES_QUERY, { count: safeCount });
    const nodes: any[] = data?.files?.nodes ?? [];
    const results = nodes
      .filter((n: any) => n?.image?.url)
      .map((n: any) => ({
        id: n.id,
        url: n.image.url,
        altText: n.image.altText ?? null,
        mimeType: n.mediaContentType || "IMAGE",
      }));
    if (results.length > 0) return results;
    // files query succeeded but returned zero — fall through to metaobjects
  } catch {
    // files query unavailable on this store — fall through to metaobjects
  }
  // Fallback: metaobjects of type "image"
  try {
    const data = await gql(METAOBJECTS_IMAGES_QUERY, { count: safeCount });
    const nodes: any[] = data?.metaobjects?.nodes ?? [];
    const results: ShopifyImage[] = [];
    for (const obj of nodes) {
      const fields: any[] = obj.fields ?? [];
      for (const field of fields) {
        const img = field.reference?.image;
        if (img?.url) {
          results.push({ id: obj.id + "_" + field.key, url: img.url, altText: img.altText ?? null, mimeType: "IMAGE" });
        }
      }
    }
    return results;
  } catch {
    // metaobjects fallback also failed — propagate original error
    throw new Error("Unable to fetch Shopify images: files API and metaobjects fallback both unavailable");
  }
}

export async function fetchCollection(rawId: string, count = 12): Promise<ShopifyCollection> {
  const id = toCollectionGid(rawId);
  const data = await gql(COLLECTION_QUERY, { id, count: Math.min(Math.max(count, 1), 24) });
  const col = data?.collection;
  if (!col) throw new Error(`Collection not found: ${rawId}`);
  return {
    id: col.id,
    title: col.title,
    handle: col.handle || "",
    description: col.description || "",
    imageUrl: col.image?.url ?? null,
    imageAlt: col.image?.altText ?? null,
    products: (col.products?.nodes ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      imageUrl: p.images?.nodes?.[0]?.url ?? null,
      imageAlt: p.images?.nodes?.[0]?.altText ?? null,
      price: p.priceRange?.minVariantPrice?.amount ?? "0",
      currencyCode: p.priceRange?.minVariantPrice?.currencyCode ?? "USD",
    })),
  };
}
