import { db } from "../db";
import { integrations } from "@shared/schema";
import { eq } from "drizzle-orm";

const ADMIN_API_VERSION = "2024-10";
const STOREFRONT_TOKEN_NAME = "WT Canvas";

interface TokenCache {
  storeDomain: string;
  storefrontToken: string;
  adminToken: string | null;
  adminExpiresAt: number | null;
}

let cache: TokenCache | null = null;

export interface ClientCredentials {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
}

export interface LegacyCredentials {
  storeDomain: string;
  storefrontToken: string;
}

export interface AdminCredentials {
  storeDomain: string;
  adminToken: string;
}

export type ResolvedCredentials = ClientCredentials | LegacyCredentials | AdminCredentials;

export function isLegacy(creds: ResolvedCredentials): creds is LegacyCredentials {
  return "storefrontToken" in creds;
}

export function isAdmin(creds: ResolvedCredentials): creds is AdminCredentials {
  return "adminToken" in creds;
}

export async function resolveCredentials(): Promise<ResolvedCredentials | null> {
  // Priority 1: Env vars with client credentials — takes precedence when fully configured
  // This follows the Shopify docs: https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens
  const envClientId = process.env.SHOPIFY_CLIENT_ID;
  const envClientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const shopSubdomain = process.env.SHOPIFY_SHOP;
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  if (envClientId && envClientSecret && (shopSubdomain || storeUrl)) {
    let storeDomain: string;
    if (shopSubdomain) {
      storeDomain = shopSubdomain.includes(".") ? shopSubdomain : `${shopSubdomain}.myshopify.com`;
    } else {
      storeDomain = storeUrl!.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
    return { storeDomain, clientId: envClientId, clientSecret: envClientSecret };
  }

  // Priority 2: DB integrations table
  try {
    const rows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.type, "shopify"))
      .limit(1);

    if (rows.length > 0) {
      const creds = rows[0].credentials as Record<string, string>;
      // Only accept shpat_ as a valid admin token — atkn_ are Partners API tokens, not Store Admin tokens
      if (creds?.storeDomain && creds?.adminToken?.startsWith("shpat_")) {
        return { storeDomain: creds.storeDomain, adminToken: creds.adminToken };
      }
      if (creds?.storeDomain && creds?.clientId && creds?.clientSecret) {
        if (creds.clientSecret.startsWith("shpat_")) {
          return { storeDomain: creds.storeDomain, adminToken: creds.clientSecret };
        }
        return { storeDomain: creds.storeDomain, clientId: creds.clientId, clientSecret: creds.clientSecret };
      }
      if (creds?.storeDomain && creds?.storefrontToken?.startsWith("shpat_")) {
        return { storeDomain: creds.storeDomain, adminToken: creds.storefrontToken };
      }
      if (creds?.storeDomain && creds?.storefrontToken) {
        return { storeDomain: creds.storeDomain, storefrontToken: creds.storefrontToken };
      }
    }
  } catch {
    // DB not available — fall through to legacy env vars
  }

  // Priority 3: Env vars — legacy storefront token only
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (domain && token) return { storeDomain: domain, storefrontToken: token };

  return null;
}

export async function fetchAdminToken(
  domain: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string; expiresAt: number }> {
  const url = `https://${domain}/admin/oauth/access_token`;
  // Shopify requires form-encoded body, NOT JSON
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Admin token exchange failed (${response.status}): ${text}`);
  }
  const json = (await response.json()) as any;
  const token: string = json.access_token;
  if (!token) throw new Error("No access_token in Admin token response");
  // Shopify returns expires_in in seconds; default to 24h if not provided
  const expiresIn: number = json.expires_in ?? 86400;
  const expiresAt = Date.now() + expiresIn * 1000;
  return { token, expiresAt };
}

export async function fetchExistingStorefrontToken(
  domain: string,
  adminToken: string
): Promise<string | null> {
  const query = `
    {
      storefrontAccessTokens(first: 100) {
        edges {
          node { id title accessToken }
        }
      }
    }
  `;
  const url = `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Admin GraphQL error ${response.status}`);
  const json = (await response.json()) as any;
  const edges: any[] = json.data?.storefrontAccessTokens?.edges ?? [];
  const existing = edges.find((e: any) => e.node?.title === STOREFRONT_TOKEN_NAME);
  return existing?.node?.accessToken ?? null;
}

export async function mintStorefrontToken(
  domain: string,
  adminToken: string
): Promise<string> {
  const mutation = `
    mutation {
      storefrontAccessTokenCreate(input: { title: "${STOREFRONT_TOKEN_NAME}" }) {
        storefrontAccessToken { accessToken }
        userErrors { field message }
      }
    }
  `;
  const url = `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify({ query: mutation }),
  });
  if (!response.ok) throw new Error(`Storefront token mint failed ${response.status}`);
  const json = (await response.json()) as any;
  const errs = json.data?.storefrontAccessTokenCreate?.userErrors ?? [];
  if (errs.length > 0) throw new Error(`Storefront token error: ${errs[0].message}`);
  const token = json.data?.storefrontAccessTokenCreate?.storefrontAccessToken?.accessToken;
  if (!token) throw new Error("No storefront accessToken returned from mutation");
  return token;
}

export async function getStorefrontToken(): Promise<string> {
  if (cache?.storefrontToken) return cache.storefrontToken;

  const creds = await resolveCredentials();
  if (!creds) throw new Error("Shopify is not configured");

  // Legacy path — already have a static token
  if (isLegacy(creds)) {
    cache = { storeDomain: creds.storeDomain, storefrontToken: creds.storefrontToken, adminToken: null, adminExpiresAt: null };
    return creds.storefrontToken;
  }

  // New path — exchange client credentials for admin token, then mint storefront token
  try {
    const { token: adminToken, expiresAt: adminExpiresAt } = await fetchAdminToken(
      creds.storeDomain, creds.clientId, creds.clientSecret
    );

    // Check if a Storefront token already exists for this app
    let storefrontToken = await fetchExistingStorefrontToken(creds.storeDomain, adminToken);
    if (!storefrontToken) {
      storefrontToken = await mintStorefrontToken(creds.storeDomain, adminToken);
    }

    cache = { storeDomain: creds.storeDomain, storefrontToken, adminToken, adminExpiresAt };
    return storefrontToken;
  } catch (err) {
    // Admin token exchange failed (e.g. credentials not valid for this flow).
    // Fall back to env-var legacy storefront token if available.
    console.warn('[Shopify] Admin token exchange failed, falling back to env-var token:', (err as Error).message);
    const envDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const envToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
    if (envDomain && envToken) {
      console.log('[Shopify] Using SHOPIFY_STOREFRONT_TOKEN env var as fallback');
      cache = { storeDomain: envDomain, storefrontToken: envToken, adminToken: null, adminExpiresAt: null };
      return envToken;
    }
    throw err;
  }
}

export async function getAdminToken(domain?: string): Promise<string> {
  const creds = await resolveCredentials();
  if (!creds) throw new Error("Shopify is not configured");

  // Direct admin token — return immediately (no expiry)
  if (isAdmin(creds)) return creds.adminToken;

  // Legacy storefront-only credentials — no admin token available
  if (isLegacy(creds)) throw new Error("No admin token available — configure Client ID + Secret or an Admin API token");

  // Client credentials — exchange for a temporary admin token with caching
  const targetDomain = domain ?? creds.storeDomain;
  const FIVE_MIN = 5 * 60 * 1000;
  if (
    cache?.adminToken &&
    cache.adminExpiresAt !== null &&
    cache.adminExpiresAt - Date.now() > FIVE_MIN
  ) {
    return cache.adminToken;
  }

  const { token, expiresAt } = await fetchAdminToken(targetDomain, creds.clientId, creds.clientSecret);
  if (cache) {
    cache.adminToken = token;
    cache.adminExpiresAt = expiresAt;
  } else {
    cache = { storeDomain: targetDomain, storefrontToken: "", adminToken: token, adminExpiresAt: expiresAt };
  }
  return token;
}

export function clearTokenCache(): void {
  cache = null;
}

export async function testWithClientCredentials(
  storeDomain: string,
  clientId: string,
  clientSecret: string
): Promise<{ name: string; domain: string }> {
  const { token: adminToken } = await fetchAdminToken(storeDomain, clientId, clientSecret);
  let storefrontToken = await fetchExistingStorefrontToken(storeDomain, adminToken);
  if (!storefrontToken) {
    storefrontToken = await mintStorefrontToken(storeDomain, adminToken);
  }

  const SHOPFRONT_API_VERSION = "2026-01";
  const SHOP_QUERY = `{ shop { name primaryDomain { url } } }`;
  const endpoint = `https://${storeDomain}/api/${SHOPFRONT_API_VERSION}/graphql.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
    },
    body: JSON.stringify({ query: SHOP_QUERY, variables: {} }),
  });
  if (!response.ok) throw new Error(`Shopify Storefront API returned ${response.status}`);
  const json = (await response.json()) as any;
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const shop = json.data?.shop;
  if (!shop) throw new Error("No shop data returned");
  return { name: shop.name, domain: shop.primaryDomain?.url ?? storeDomain };
}
