import { resolveCredentials, isLegacy, getStorefrontToken } from "./shopifyTokenManager";

const SHOPIFY_API_VERSION = "2024-10";

async function getShopifyCredentials(): Promise<{ domain: string; token: string } | null> {
  const creds = await resolveCredentials();
  if (!creds) return null;

  if (isLegacy(creds)) {
    return { domain: creds.storeDomain, token: creds.storefrontToken };
  }

  // New-style: exchange credentials for a Storefront token
  const token = await getStorefrontToken();
  return { domain: creds.storeDomain, token };
}

function sanitizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function getEndpointFromCreds(domain: string): string {
  return `https://${sanitizeDomain(domain)}/api/${SHOPIFY_API_VERSION}/graphql.json`;
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

export async function testShopifyConnection(storeDomain: string, storefrontToken: string): Promise<{ name: string; domain: string }> {
  const endpoint = getEndpointFromCreds(storeDomain);
  console.log(`[Shopify] testShopifyConnection → endpoint: ${endpoint}, token prefix: ${storefrontToken?.slice(0, 12)}...`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
    },
    body: JSON.stringify({ query: SHOP_QUERY, variables: {} }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[Shopify] testShopifyConnection 401 body: ${body}`);
    if (response.status === 401) {
      throw new Error(
        `Shopify returned 401. Most likely fix: in your Shopify admin go to Settings → Apps → Develop apps → [your app] → Configuration, enable "Storefront API integration", add the scope "unauthenticated_read_product_listings", save, then go to API credentials and copy the fresh Storefront API access token.`
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

export async function fetchProductList(
  count = 40,
  query?: string,
  after?: string,
): Promise<PaginatedResult<ShopifyProductSummary>> {
  const safeCount = Math.min(Math.max(count, 1), 40);
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
