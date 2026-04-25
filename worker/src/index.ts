import { createClient } from "@supabase/supabase-js";
import { renderPageHtml, render404, renderSiteHeader, renderSiteFooter, Page, SiteSettings } from "./renderer/blockToHtml";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SITE_BASE_URL: string;
  SHOPIFY_STOREFRONT_TOKEN?: string;
  SHOPIFY_STORE_DOMAIN?: string;
  WTC_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Static worker-owned paths
    if (path === "/sitemap.xml" || path === "/articles/sitemap.xml") return handleSitemap(env);
    if (path === "/robots.txt" || path === "/articles/robots.txt") return handleRobots(env);
    if (path === "/articles/styles/wt-pages.css" || path === "/styles/wt-pages.css") return handleCss();
    if (path === "/articles/components/loader.js" || path === "/components/loader.js") return handleComponentLoader();

    // Articles index page
    if (path === "/articles" || path === "/articles/") return handleIndex(env);

    // Articles content — strip /articles prefix to get bare slug
    if (path.startsWith("/articles/")) {
      const normalizedPath = path.slice("/articles".length); // → /slug
      const redirect = await checkRedirects(normalizedPath, env);
      if (redirect) return Response.redirect(redirect, 301);
      return handlePage(normalizedPath, env);
    }

    // Everything else → pass through to Shopify origin (avoids loop back to this worker)
    return proxyToShopify(request);
  },
};

async function proxyToShopify(request: Request): Promise<Response> {
  // resolveOverride routes to Shopify's servers while keeping the original Host header
  // (welltolddesign.com) intact — so Shopify identifies the correct store.
  // Changing the URL hostname would cause Cloudflare to strip the Host override.
  const init: RequestInit & { cf?: any } = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
    cf: { resolveOverride: "welltold.myshopify.com" },
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }
  return fetch(request.url, init);
}

/** Map a row from blog_articles / landing_pages / lead_magnets to the Page shape. */
function normaliseRow(row: Record<string, any>): Page {
  return {
    id: String(row.id),
    title: row.title ?? "",
    slug: row.slug ?? "",
    status: row.status ?? "live",
    meta_description: row.meta_description ?? null,
    content_json: row.content_json ?? null,
    content_markdown: row.content_markdown ?? null,
    featured_image: row.featured_image ?? row.image_url ?? null,
    og_image: row.og_image ?? null,
    og_title: row.og_title ?? null,
    canonical_url: row.canonical_url ?? null,
    page_template: row.page_template ?? null,
    structured_data: row.structured_data ?? null,
    custom_css: row.custom_css ?? null,
    redirect_from: row.redirect_from ?? null,
    published_at: row.published_at ?? null,
    updated_at: row.updated_at ?? undefined,
  };
}

async function handleIndex(env: Env): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const base = env.SITE_BASE_URL;

  const [siteSettings, blogs, landings, leads] = await Promise.all([
    fetchSiteSettings(env),
    supabase.from("blog_articles").select("id,title,slug,meta_description,featured_image,image_url,published_at,updated_at,tags").eq("status", "live").order("published_at", { ascending: false }),
    supabase.from("landing_pages").select("id,title,slug,meta_description,featured_image,image_url,published_at,updated_at,tags").eq("status", "live").order("published_at", { ascending: false }),
    supabase.from("lead_magnets").select("id,title,slug,meta_description,featured_image,image_url,published_at,updated_at,tags").eq("status", "live").order("published_at", { ascending: false }),
  ]);

  const articles = [
    ...(blogs.data || []).map((r: any) => ({ ...r, _type: "Article" })),
    ...(landings.data || []).map((r: any) => ({ ...r, _type: "Page" })),
    ...(leads.data || []).map((r: any) => ({ ...r, _type: "Guide" })),
  ].sort((a, b) => {
    const da = a.published_at ? new Date(a.published_at).getTime() : 0;
    const db2 = b.published_at ? new Date(b.published_at).getTime() : 0;
    return db2 - da;
  });

  const html = renderIndexHtml(articles, base, siteSettings);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}

function renderIndexHtml(articles: any[], base: string, siteSettings: SiteSettings): string {
  const featured = articles.slice(0, 3);
  const allArticles = articles;

  const allTags: string[] = [];
  for (const a of articles) {
    if (Array.isArray(a.tags)) {
      for (const t of a.tags) {
        if (t && !allTags.includes(t)) allTags.push(t);
      }
    }
  }
  allTags.sort();

  function esc(s: string | null | undefined): string {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch { return ""; }
  }

  function tagsAttr(tags: any): string {
    if (!Array.isArray(tags) || tags.length === 0) return "";
    return tags.map((t: string) => t.toLowerCase().replace(/\s+/g, "-")).join(" ");
  }

  function featuredCard(a: any): string {
    const img = a.featured_image || a.image_url || "";
    const tags = Array.isArray(a.tags) ? a.tags : [];
    return `
    <a href="${esc(base)}/${esc(a.slug)}" class="wt-idx-featured-card" data-tags="${esc(tagsAttr(a.tags))}">
      ${img ? `<div class="wt-idx-featured-img-wrap"><img src="${esc(img)}" alt="${esc(a.title)}" loading="lazy" /></div>` : `<div class="wt-idx-featured-img-wrap wt-idx-featured-img-placeholder"></div>`}
      <div class="wt-idx-featured-body">
        <div class="wt-idx-meta">
          <span class="wt-idx-type">${esc(a._type)}</span>
          ${tags.slice(0, 2).map((t: string) => `<span class="wt-idx-tag">${esc(t)}</span>`).join("")}
        </div>
        <h2 class="wt-idx-featured-title">${esc(a.title)}</h2>
        ${a.meta_description ? `<p class="wt-idx-featured-desc">${esc(a.meta_description)}</p>` : ""}
        <span class="wt-idx-date">${formatDate(a.published_at)}</span>
      </div>
    </a>`;
  }

  function listCard(a: any): string {
    const img = a.featured_image || a.image_url || "";
    const tags = Array.isArray(a.tags) ? a.tags : [];
    return `
    <a href="${esc(base)}/${esc(a.slug)}" class="wt-idx-list-card" data-tags="${esc(tagsAttr(a.tags))}">
      ${img ? `<div class="wt-idx-list-img"><img src="${esc(img)}" alt="${esc(a.title)}" loading="lazy" /></div>` : `<div class="wt-idx-list-img wt-idx-list-img-placeholder"></div>`}
      <div class="wt-idx-list-body">
        <div class="wt-idx-meta">
          <span class="wt-idx-type">${esc(a._type)}</span>
          ${tags.slice(0, 3).map((t: string) => `<span class="wt-idx-tag">${esc(t)}</span>`).join("")}
        </div>
        <h3 class="wt-idx-list-title">${esc(a.title)}</h3>
        ${a.meta_description ? `<p class="wt-idx-list-desc">${esc(a.meta_description)}</p>` : ""}
        <span class="wt-idx-date">${formatDate(a.published_at)}</span>
      </div>
    </a>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Articles &amp; Pages — Well Told</title>
  <meta name="description" content="Browse all articles, guides and pages from Well Told." />
  <link rel="stylesheet" href="${esc(base)}/styles/wt-pages.css" />
  <style>
    /* Index page overrides */
    .wt-idx-content { max-width: 1100px; margin: 0 auto; padding: 3rem 2rem 6rem; }
    .wt-idx-heading { font-size: 2rem; font-weight: 800; margin: 0 0 0.25rem; }
    .wt-idx-subhead { color: #555; font-size: 1rem; margin: 0 0 2.5rem; }

    /* Filter bar */
    .wt-idx-filter { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 3rem; }
    .wt-idx-filter-btn {
      padding: 0.4rem 1rem; border: 1px solid #000; background: #fff;
      font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; cursor: pointer; transition: background 0.12s, color 0.12s;
    }
    .wt-idx-filter-btn:hover, .wt-idx-filter-btn.active { background: #000; color: #fff; }

    /* Featured grid */
    .wt-idx-featured-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #555; margin: 0 0 1rem; }
    .wt-idx-featured-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 4rem; }
    @media (max-width: 800px) { .wt-idx-featured-grid { grid-template-columns: 1fr; } }
    .wt-idx-featured-card {
      display: flex; flex-direction: column; text-decoration: none; color: #000;
      border: 1px solid #000; background: #f0ebe7; transition: box-shadow 0.15s;
    }
    .wt-idx-featured-card:hover { box-shadow: 4px 4px 0 #000; }
    .wt-idx-featured-img-wrap { overflow: hidden; aspect-ratio: 16/9; border-bottom: 1px solid #000; }
    .wt-idx-featured-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
    .wt-idx-featured-card:hover .wt-idx-featured-img-wrap img { transform: scale(1.03); }
    .wt-idx-featured-img-placeholder { background: #ddd; aspect-ratio: 16/9; border-bottom: 1px solid #000; }
    .wt-idx-featured-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
    .wt-idx-featured-title { font-size: 1.1rem; font-weight: 700; margin: 0; line-height: 1.3; }
    .wt-idx-featured-desc { font-size: 0.85rem; color: #555; margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    /* Divider */
    .wt-idx-divider { border: none; border-top: 1px solid #000; margin: 0 0 2rem; }

    /* List grid */
    .wt-idx-list-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #555; margin: 0 0 1rem; }
    .wt-idx-list-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; border: 1px solid #000; }
    @media (max-width: 600px) { .wt-idx-list-grid { grid-template-columns: 1fr; } }
    .wt-idx-list-card {
      display: flex; gap: 1rem; text-decoration: none; color: #000;
      padding: 1rem; background: #fff; border-right: 1px solid #000; border-bottom: 1px solid #000;
      transition: background 0.12s;
    }
    .wt-idx-list-card:hover { background: #f0ebe7; }
    .wt-idx-list-img { width: 80px; height: 80px; flex-shrink: 0; border: 1px solid #000; overflow: hidden; }
    .wt-idx-list-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .wt-idx-list-img-placeholder { width: 80px; height: 80px; background: #ddd; flex-shrink: 0; border: 1px solid #000; }
    .wt-idx-list-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .wt-idx-list-title { font-size: 0.95rem; font-weight: 700; margin: 0; line-height: 1.3; }
    .wt-idx-list-desc { font-size: 0.8rem; color: #555; margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    /* Shared meta */
    .wt-idx-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
    .wt-idx-type { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #555; }
    .wt-idx-tag { font-size: 0.65rem; font-weight: 600; padding: 0.15rem 0.5rem; border: 1px solid #aaa; color: #555; background: #fff; }
    .wt-idx-date { font-size: 0.75rem; color: #888; margin-top: auto; }

    /* Empty state */
    .wt-idx-empty { padding: 3rem; text-align: center; color: #888; font-size: 0.9rem; grid-column: 1 / -1; }

    /* Hidden by filter */
    .wt-idx-hidden { display: none !important; }
    .wt-idx-no-results { display: none; padding: 2rem; text-align: center; color: #888; font-size: 0.9rem; }
    .wt-idx-no-results.visible { display: block; }
  </style>
</head>
<body>
  ${renderSiteHeader(siteSettings)}

  <main class="wt-page">
    <div class="wt-idx-content">
      <h1 class="wt-idx-heading">Articles &amp; Pages</h1>
      <p class="wt-idx-subhead">${articles.length} ${articles.length === 1 ? "item" : "items"} published</p>

      ${allTags.length > 0 ? `
      <div class="wt-idx-filter" id="wt-filter">
        <button class="wt-idx-filter-btn active" data-filter="*">All</button>
        ${allTags.map(t => `<button class="wt-idx-filter-btn" data-filter="${esc(t.toLowerCase().replace(/\s+/g, "-"))}">${esc(t)}</button>`).join("")}
      </div>` : ""}

      ${featured.length > 0 ? `
      <p class="wt-idx-featured-label">Featured</p>
      <div class="wt-idx-featured-grid" id="wt-featured">
        ${featured.map(featuredCard).join("")}
      </div>` : ""}

      <hr class="wt-idx-divider" />

      <p class="wt-idx-list-label">All Content</p>
      <div class="wt-idx-list-grid" id="wt-list">
        ${allArticles.length > 0 ? allArticles.map(listCard).join("") : `<div class="wt-idx-empty">No published content yet.</div>`}
      </div>
      <div class="wt-idx-no-results" id="wt-no-results">No results for this filter.</div>
    </div>
  </main>

  <script>
  (function() {
    var activeFilter = "*";
    var filterBar = document.getElementById("wt-filter");
    var featured = document.getElementById("wt-featured");
    var list = document.getElementById("wt-list");
    var noResults = document.getElementById("wt-no-results");
    if (!filterBar) return;

    function applyFilter(f) {
      activeFilter = f;
      var anyVisible = false;

      [].slice.call(document.querySelectorAll(".wt-idx-featured-card, .wt-idx-list-card")).forEach(function(card) {
        if (f === "*") {
          card.classList.remove("wt-idx-hidden");
          anyVisible = true;
        } else {
          var tags = (card.getAttribute("data-tags") || "").split(" ").filter(Boolean);
          if (tags.indexOf(f) !== -1) {
            card.classList.remove("wt-idx-hidden");
            anyVisible = true;
          } else {
            card.classList.add("wt-idx-hidden");
          }
        }
      });

      if (noResults) {
        noResults.classList.toggle("visible", !anyVisible && f !== "*");
      }
    }

    [].slice.call(filterBar.querySelectorAll(".wt-idx-filter-btn")).forEach(function(btn) {
      btn.addEventListener("click", function() {
        [].slice.call(filterBar.querySelectorAll(".wt-idx-filter-btn")).forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        applyFilter(btn.getAttribute("data-filter") || "*");
      });
    });
  })();
  </script>
  ${renderSiteFooter(siteSettings)}
</body>
</html>`;
}

async function handlePage(path: string, env: Env): Promise<Response> {
  const slug = path.replace(/^\//, "").replace(/\/$/, "") || "home";
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const [siteSettings, blogResult, landingResult, leadResult] = await Promise.all([
    fetchSiteSettings(env),
    supabase.from("blog_articles").select("*").eq("slug", slug).eq("status", "live").maybeSingle(),
    supabase.from("landing_pages").select("*").eq("slug", slug).eq("status", "live").maybeSingle(),
    supabase.from("lead_magnets").select("*").eq("slug", slug).eq("status", "live").maybeSingle(),
  ]);

  const raw = blogResult.data ?? landingResult.data ?? leadResult.data ?? null;
  const page: Page | null = raw ? normaliseRow(raw) : null;

  if (!page) {
    return new Response(render404(siteSettings, env.SITE_BASE_URL), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  const shopifyFetcher = createShopifyFetcher(env);
  const html = await renderPageHtml(page, env.SITE_BASE_URL, shopifyFetcher, siteSettings);

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}

async function handleSitemap(env: Env): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const base = env.SITE_BASE_URL;

  const [blogs, landings, leads] = await Promise.all([
    supabase.from("blog_articles").select("slug, updated_at").eq("status", "live"),
    supabase.from("landing_pages").select("slug, updated_at").eq("status", "live"),
    supabase.from("lead_magnets").select("slug, updated_at").eq("status", "live"),
  ]);
  const pagesData = [
    ...(blogs.data || []),
    ...(landings.data || []),
    ...(leads.data || []),
  ];

  const urls = (pagesData || [])
    .map(
      (p) => `
  <url>
    <loc>${base}/${p.slug}</loc>
    <lastmod>${p.updated_at?.split("T")[0] || ""}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

async function handleRobots(env: Env): Promise<Response> {
  return new Response(
    `User-agent: *
Allow: /
Sitemap: ${env.SITE_BASE_URL}/sitemap.xml

Disallow: /api/
Disallow: /admin/`,
    { headers: { "Content-Type": "text/plain" } }
  );
}

// ── Site Settings fetcher ─────────────────────────────────────────────────────

async function fetchSiteSettings(env: Env): Promise<SiteSettings> {
  if (!env.WTC_API_URL) return {};
  try {
    const res = await fetch(`${env.WTC_API_URL}/api/public/site-settings`, {
      headers: { "Accept": "application/json" },
      // CF cache: reuse for 30 s so settings updates appear quickly
      cf: { cacheTtl: 30, cacheEverything: true } as any,
    });
    if (!res.ok) return {};
    return await res.json() as SiteSettings;
  } catch {
    return {};
  }
}

// ── Shopify Storefront API fetcher (inline for Workers bundle) ────────────────

const SHOPIFY_PRODUCT_QUERY = `query GetProduct($id:ID!){product(id:$id){id title handle description images(first:1){nodes{url altText}} priceRange{minVariantPrice{amount currencyCode}} variants(first:20){nodes{id title price{amount} availableForSale selectedOptions{name value}}}}}`;
const SHOPIFY_COLLECTION_QUERY = `query GetCollection($id:ID!,$count:Int!){collection(id:$id){id title handle description image{url altText} products(first:$count){nodes{id title handle images(first:1){nodes{url altText}} priceRange{minVariantPrice{amount currencyCode}}}}}}`;

function createShopifyFetcher(env: Env) {
  if (!env.SHOPIFY_STOREFRONT_TOKEN || !env.SHOPIFY_STORE_DOMAIN) return null;
  const endpoint = `https://${env.SHOPIFY_STORE_DOMAIN}/api/2024-01/graphql.json`;
  const token = env.SHOPIFY_STOREFRONT_TOKEN;

  async function shopifyGql(query: string, variables: Record<string, any>): Promise<any> {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });
    if (!r.ok) throw new Error(`Shopify ${r.status}`);
    const json = (await r.json()) as any;
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  }

  function toProductGid(id: string) { return id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`; }
  function toCollectionGid(id: string) { return id.startsWith("gid://") ? id : `gid://shopify/Collection/${id}`; }

  return {
    async fetchProduct(rawId: string) {
      const data = await shopifyGql(SHOPIFY_PRODUCT_QUERY, { id: toProductGid(rawId) });
      const p = data?.product;
      if (!p) throw new Error(`Product not found: ${rawId}`);
      return {
        id: p.id, title: p.title, handle: p.handle, description: p.description || "",
        imageUrl: p.images?.nodes?.[0]?.url ?? null,
        imageAlt: p.images?.nodes?.[0]?.altText ?? null,
        price: p.priceRange?.minVariantPrice?.amount ?? "0",
        currencyCode: p.priceRange?.minVariantPrice?.currencyCode ?? "USD",
        variants: (p.variants?.nodes ?? []).map((v: any) => ({
          id: v.id, title: v.title, price: v.price?.amount ?? "0", available: v.availableForSale ?? false,
          options: (v.selectedOptions ?? []).map((o: any) => ({ name: o.name, value: o.value })),
        })),
      };
    },
    async fetchCollection(rawId: string, count = 12) {
      const data = await shopifyGql(SHOPIFY_COLLECTION_QUERY, { id: toCollectionGid(rawId), count: Math.min(count, 24) });
      const col = data?.collection;
      if (!col) throw new Error(`Collection not found: ${rawId}`);
      return {
        id: col.id, title: col.title, handle: col.handle || "", description: col.description || "",
        imageUrl: col.image?.url ?? null, imageAlt: col.image?.altText ?? null,
        products: (col.products?.nodes ?? []).map((p: any) => ({
          id: p.id, title: p.title, handle: p.handle,
          imageUrl: p.images?.nodes?.[0]?.url ?? null, imageAlt: p.images?.nodes?.[0]?.altText ?? null,
          price: p.priceRange?.minVariantPrice?.amount ?? "0",
          currencyCode: p.priceRange?.minVariantPrice?.currencyCode ?? "USD",
        })),
      };
    },
  };
}

async function checkRedirects(path: string, env: Env): Promise<string | null> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const slug = path.replace(/^\//, "");

  const [blog, landing, lead] = await Promise.all([
    supabase.from("blog_articles").select("slug").contains("redirect_from", [slug]).maybeSingle(),
    supabase.from("landing_pages").select("slug").contains("redirect_from", [slug]).maybeSingle(),
    supabase.from("lead_magnets").select("slug").contains("redirect_from", [slug]).maybeSingle(),
  ]);
  const data = blog.data ?? landing.data ?? lead.data ?? null;
  if (data) return `${env.SITE_BASE_URL}/${data.slug}`;

  return null;
}

function handleComponentLoader(): Response {
  // Lightweight client-side loader: finds all [data-wt-component] elements and
  // calls window.__WTC_INIT[name](el, config) once the component bundle registers.
  // Exposes window.__WTC_RUN so component bundles can trigger init after loading.
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
      } else {
        // Mark as un-initialised so next __WTC_RUN call can retry
        delete el.__wtInit;
      }
    });
  }
  // Expose globally so component bundles can call window.__WTC_RUN() after registering
  window.__WTC_RUN=init;
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();`;
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function handleCss(): Response {
  const css = `/* Well Told — public page styles */
*, *::before, *::after { box-sizing: border-box; }

@font-face {
  font-family: 'Cera Pro';
  src: url('https://welltolddesign.com/cdn/shop/t/87/assets/CeraProRegular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Cera Pro';
  src: url('https://welltolddesign.com/cdn/shop/t/87/assets/CeraProBold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --wt-font-sans: 'Cera Pro', -apple-system, BlinkMacSystemFont, sans-serif;
  --wt-font-serif: Georgia, "Times New Roman", serif;
  --wt-color-text: #000000;
  --wt-color-muted: #555;
  --wt-color-accent: #04a7cd;
  --wt-color-bg: #fff;
  --wt-color-surface: #F5F5F5;
  --wt-color-border: #000000;
  --wt-max-width: 720px;
  --wt-gutter: 2rem;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Cera Pro', -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 400;
  font-size: 18px;
  line-height: 1.7;
  color: #000000;
  background: #ffffff;
}
h1, h2, h3, h4 {
  font-family: 'Cera Pro', sans-serif;
  font-weight: 700;
}
a { color: inherit; }

.wt-page { min-height: 100vh; }

.wt-content {
  max-width: var(--wt-max-width);
  margin: 0 auto;
  padding: 4rem var(--wt-gutter) 6rem;
}

/* Headings */
.wt-heading { font-family: var(--wt-font-sans); font-weight: 700; line-height: 1.2; margin: 2.5rem 0 1rem; color: var(--wt-color-text); }
.wt-h1 { font-size: 2.5rem; margin-top: 0; }
.wt-h2 { font-size: 1.75rem; }
.wt-h3 { font-size: 1.35rem; }
.wt-h4 { font-size: 1.1rem; }

/* Paragraph */
.wt-paragraph { margin: 0 0 1.5rem; }

/* Lists */
.wt-list { margin: 0 0 1.5rem; padding-left: 1.75rem; }
.wt-list li { margin-bottom: 0.5rem; }

/* Quote */
.wt-quote {
  margin: 2rem 0;
  padding: 1.5rem 2rem;
  border-left: 4px solid var(--wt-color-border);
  background: var(--wt-color-surface);
  font-style: italic;
}
.wt-quote p { margin: 0 0 0.75rem; font-size: 1.15rem; }
.wt-quote p:last-child { margin: 0; }
.wt-cite { display: block; font-style: normal; font-weight: 600; font-size: 0.9rem; color: var(--wt-color-muted); }

/* Figure / Image */
.wt-figure { margin: 2.5rem 0; }
.wt-figure img { width: 100%; height: auto; display: block; border: 1px solid var(--wt-color-border); }
.wt-caption { margin-top: 0.5rem; font-size: 0.85rem; color: var(--wt-color-muted); font-style: italic; }

/* CTA */
.wt-cta {
  margin: 2.5rem 0;
  padding: 1rem 0;
  text-align: center;
}
.wt-cta-text { font-size: 1.1rem; margin: 0 0 1.25rem; }
.wt-cta-button {
  display: inline-block;
  padding: 0.75rem 2rem;
  background: var(--wt-color-accent);
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.03em;
}
.wt-cta-button:hover { opacity: 0.85; }

/* Divider */
.wt-divider { border: none; border-top: 1px solid var(--wt-color-border); margin: 2.5rem 0; }
.wt-divider-space { display: block; }
.wt-divider-space--small  { height: 1rem; }
.wt-divider-space--medium { height: 2.5rem; }
.wt-divider-space--large  { height: 5rem; }

/* Spacer */
.wt-spacer { display: block; }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.wt-hero { position: relative; margin: 0 calc(-1 * var(--wt-gutter)) 3rem; overflow: hidden; }
.wt-hero-image { width: 100%; max-height: 480px; object-fit: cover; display: block; border-bottom: 2px solid var(--wt-color-border); }
.wt-hero-body { padding: 2.5rem var(--wt-gutter) 2rem; background: var(--wt-color-surface); }
.wt-hero-headline { font-family: var(--wt-font-sans); font-size: 2.75rem; font-weight: 800; line-height: 1.1; margin: 0 0 1rem; color: var(--wt-color-text); }
.wt-hero-subtext { font-size: 1.2rem; color: var(--wt-color-muted); margin: 0 0 1.5rem; max-width: 600px; }
.wt-hero-cta { display: inline-block; padding: 0.8rem 2rem; background: var(--wt-color-accent); color: #fff; text-decoration: none; font-weight: 700; letter-spacing: 0.02em; border: 2px solid var(--wt-color-border); }
.wt-hero-cta:hover { opacity: 0.85; }

/* ── Two Column ─────────────────────────────────────────────────────────── */
.wt-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; margin: 2.5rem 0; }
.wt-two-col-left, .wt-two-col-right { min-width: 0; }

/* ── Accordion / FAQ ────────────────────────────────────────────────────── */
.wt-accordion { margin: 2rem 0; }
.wt-accordion-title { font-family: 'Cera Pro', sans-serif; font-size: 1.5rem; font-weight: 700; margin: 0 0 1.25rem; color: var(--wt-color-text); }
.wt-accordion-item { border: 1px solid var(--wt-color-border); border-bottom: none; }
.wt-accordion-item:last-child { border-bottom: 1px solid var(--wt-color-border); }
.wt-accordion-question { display: block; padding: 1rem 1.25rem; font-weight: 600; cursor: pointer; list-style: none; background: var(--wt-color-surface); user-select: none; }
.wt-accordion-question::-webkit-details-marker { display: none; }
.wt-accordion-question::after { content: "+"; float: right; font-size: 1.25rem; line-height: 1; color: var(--wt-color-muted); }
.wt-accordion-item[open] .wt-accordion-question::after { content: "−"; }
.wt-accordion-answer { padding: 1rem 1.25rem 1.25rem; border-top: 1px solid var(--wt-color-border); }

/* ── Banner / Alert ─────────────────────────────────────────────────────── */
.wt-banner { display: flex; align-items: center; justify-content: center; gap: 1.25rem; padding: 0.9rem 1.5rem; margin: 2rem 0; border: 2px solid var(--wt-color-border); flex-wrap: wrap; }
.wt-banner-text { margin: 0; font-weight: 600; font-size: 0.95rem; }
.wt-banner-link { font-weight: 700; font-size: 0.9rem; text-decoration: underline; white-space: nowrap; }
.wt-banner--info    { background: #e8f0fe; color: #1a3a8f; border-color: #1a3a8f; }
.wt-banner--sale    { background: #fef3c7; color: #78350f; border-color: #78350f; }
.wt-banner--warning { background: #fde8e8; color: #7f1d1d; border-color: #7f1d1d; }

/* ── Icon + Text Row ────────────────────────────────────────────────────── */
.wt-icon-row { display: grid; gap: 2rem; margin: 2.5rem 0; }
.wt-icon-row--3 { grid-template-columns: repeat(3, 1fr); }
.wt-icon-row--4 { grid-template-columns: repeat(4, 1fr); }
.wt-icon-item { text-align: center; }
.wt-icon-item-icon { margin-bottom: 0.75rem; }
.wt-icon-item-icon img { width: 48px; height: 48px; object-fit: contain; display: inline-block; }
.wt-icon-item-headline { font-size: 1rem; font-weight: 700; margin: 0 0 0.4rem; }
.wt-icon-item-body { font-size: 0.9rem; color: var(--wt-color-muted); margin: 0; }

/* ── Author / Bio ───────────────────────────────────────────────────────── */
.wt-author { display: flex; gap: 1.5rem; align-items: flex-start; margin: 2.5rem 0; padding: 1.5rem; background: var(--wt-color-surface); border: 1px solid var(--wt-color-border); }
.wt-author-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid var(--wt-color-border); }
.wt-author-info { flex: 1; min-width: 0; }
.wt-author-name { font-weight: 700; font-size: 1rem; margin: 0 0 0.4rem; }
.wt-author-bio  { font-size: 0.9rem; color: var(--wt-color-muted); margin: 0 0 0.75rem; }
.wt-author-links { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.wt-author-links a { font-size: 0.85rem; font-weight: 600; color: var(--wt-color-accent); text-decoration: underline; }

/* ── Breadcrumb ─────────────────────────────────────────────────────────── */
.wt-breadcrumb { margin: 0 0 2rem; }
.wt-breadcrumb-list { display: flex; flex-wrap: wrap; gap: 0.25rem; list-style: none; margin: 0; padding: 0; font-size: 0.85rem; color: var(--wt-color-muted); }
.wt-breadcrumb-item a { color: var(--wt-color-muted); text-decoration: underline; }
.wt-breadcrumb-item a:hover { color: var(--wt-color-text); }
.wt-breadcrumb-sep { color: var(--wt-color-muted); padding: 0 0.1rem; }

/* ── Related Content ────────────────────────────────────────────────────── */
.wt-related { margin: 3rem 0; }
.wt-related-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--wt-color-muted); margin: 0 0 1rem; }
.wt-related-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.25rem; }
.wt-related-card { display: block; text-decoration: none; color: var(--wt-color-text); border: 1px solid var(--wt-color-border); transition: box-shadow 0.15s; }
.wt-related-card:hover { box-shadow: 3px 3px 0 var(--wt-color-border); }
.wt-related-card-img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; border-bottom: 1px solid var(--wt-color-border); }
.wt-related-card-body { padding: 0.75rem; }
.wt-related-card-type { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--wt-color-muted); margin: 0 0 0.3rem; }
.wt-related-card-title { font-size: 0.9rem; font-weight: 600; margin: 0; }

/* ── Shopify Blocks (Tier 4) ────────────────────────────────────────────── */

/* Product Card */
.wt-shopify-card { display: flex; flex-direction: column; margin: 2.5rem 0; border: 1px solid var(--wt-color-border); }
.wt-shopify-card-img-link { display: block; overflow: hidden; }
.wt-shopify-card-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; border-bottom: 1px solid var(--wt-color-border); }
.wt-shopify-card-body { padding: 1.5rem; flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
.wt-shopify-card-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
.wt-shopify-card-desc { font-size: 0.9rem; color: var(--wt-color-muted); margin: 0; line-height: 1.5; }
.wt-shopify-card-price { font-size: 1.15rem; font-weight: 700; margin: 0; }
.wt-shopify-card-cta { align-self: flex-start; margin-top: auto; }

/* Product Grid */
.wt-shopify-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.5rem; margin: 2.5rem 0; }
.wt-shopify-mini-card { display: block; text-decoration: none; color: var(--wt-color-text); border: 1px solid var(--wt-color-border); transition: box-shadow 0.15s; }
.wt-shopify-mini-card:hover { box-shadow: 3px 3px 0 var(--wt-color-border); }
.wt-shopify-mini-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; border-bottom: 1px solid var(--wt-color-border); }
.wt-shopify-mini-img-placeholder { width: 100%; aspect-ratio: 1; background: var(--wt-color-surface); border-bottom: 1px solid var(--wt-color-border); }
.wt-shopify-mini-body { padding: 0.75rem; }
.wt-shopify-mini-title { font-size: 0.9rem; font-weight: 600; margin: 0 0 0.3rem; }
.wt-shopify-mini-price { font-size: 0.85rem; color: var(--wt-color-muted); margin: 0; }

/* Collection Feature */
.wt-shopify-feature { margin: 2.5rem 0; border: 2px solid var(--wt-color-border); overflow: hidden; }
.wt-shopify-feature-img-wrap { overflow: hidden; max-height: 420px; border-bottom: 2px solid var(--wt-color-border); }
.wt-shopify-feature-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.wt-shopify-feature-body { padding: 2rem; }
.wt-shopify-feature--dark { background: var(--wt-color-text); color: #fff; border-color: var(--wt-color-text); }
.wt-shopify-feature--dark .wt-shopify-feature-img-wrap { border-color: #444; }
.wt-shopify-feature--dark .wt-shopify-feature-subtext { color: #ccc; }
.wt-shopify-feature--dark .wt-shopify-feature-cta { background: #fff; color: var(--wt-color-text); }
.wt-shopify-feature--light { background: var(--wt-color-surface); }
.wt-shopify-feature-headline { font-size: 1.75rem; font-weight: 800; margin: 0 0 0.75rem; line-height: 1.2; }
.wt-shopify-feature-subtext { font-size: 1rem; color: var(--wt-color-muted); margin: 0 0 1.5rem; line-height: 1.6; }
.wt-shopify-feature-cta { display: inline-block; }

/* Variant Selector */
.wt-shopify-variants { margin: 2.5rem 0; padding: 1.5rem 2rem; background: var(--wt-color-surface); border: 2px solid var(--wt-color-border); }
.wt-shopify-variants-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 1rem; }
.wt-shopify-variant-btns { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.5rem; }
.wt-shopify-variant-btn { padding: 0.5rem 1.1rem; border: 2px solid var(--wt-color-border); background: #fff; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.12s, color 0.12s; }
.wt-shopify-variant-btn:hover { background: var(--wt-color-border); color: #fff; }
.wt-shopify-variant-btn--active { background: var(--wt-color-border); color: #fff; }
.wt-shopify-variant-btn--unavailable { opacity: 0.4; cursor: not-allowed; text-decoration: line-through; }
.wt-shopify-variant-cta { display: inline-block; }

/* Placeholder (shown when Shopify credentials not configured) */
.wt-shopify-placeholder { margin: 2rem 0; padding: 1.25rem 1.5rem; border: 2px dashed #ccc; background: #fafafa; color: var(--wt-color-muted); font-size: 0.9rem; }
.wt-shopify-placeholder code { font-family: monospace; background: #f0f0f0; padding: 0.1em 0.4em; border-radius: 3px; }

/* Site Header */
.wt-site-header {
  border-bottom: 1px solid var(--wt-color-border);
  background: var(--wt-color-bg);
  position: sticky;
  top: 0;
  z-index: 100;
}
.wt-nav {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem var(--wt-gutter);
  display: flex;
  align-items: center;
  gap: 2rem;
}
.wt-nav__logo-link { display: flex; align-items: center; text-decoration: none; margin-right: auto; }
.wt-nav__logo { height: 36px; width: auto; display: block; }
.wt-nav__links { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
.wt-nav__link {
  color: var(--wt-color-text);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: opacity 0.15s;
}
.wt-nav__link:hover { opacity: 0.65; }

/* Site Footer */
.wt-site-footer {
  border-top: 1px solid var(--wt-color-border);
  margin-top: 4rem;
  background: var(--wt-color-surface);
}
.wt-footer__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.5rem var(--wt-gutter);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.wt-footer__links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.wt-footer__link {
  color: var(--wt-color-text);
  text-decoration: none;
  font-size: 0.9rem;
}
.wt-footer__link:hover { text-decoration: underline; }
.wt-footer__address, .wt-footer__copyright {
  margin: 0;
  font-size: 0.85rem;
  color: var(--wt-color-muted);
}

/* 404 page */
.wt-404 {
  max-width: var(--wt-max-width);
  margin: 0 auto;
  padding: 6rem var(--wt-gutter);
  text-align: center;
}
.wt-404__code {
  font-size: 5rem;
  font-weight: 700;
  line-height: 1;
  margin: 0;
  color: var(--wt-color-muted);
}
.wt-404__heading { margin-top: 1rem; }
.wt-404__body {
  color: var(--wt-color-muted);
  font-size: 1.1rem;
  margin: 1rem 0 2.5rem;
}
.wt-404__cta {
  display: inline-block;
  padding: 0.75rem 2rem;
  border: 2px solid var(--wt-color-border);
  background: var(--wt-color-text);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
}
.wt-404__cta:hover { opacity: 0.85; }

/* Responsive */
@media (max-width: 640px) {
  :root { --wt-gutter: 1.25rem; }
  body { font-size: 17px; }
  .wt-h1 { font-size: 2rem; }
  .wt-h2 { font-size: 1.5rem; }
  .wt-hero-headline { font-size: 2rem; }
  .wt-two-col { grid-template-columns: 1fr; }
  .wt-icon-row--3, .wt-icon-row--4 { grid-template-columns: 1fr; }
  .wt-author { flex-direction: column; }
  .wt-shopify-grid { grid-template-columns: repeat(2, 1fr); }
  .wt-nav { flex-wrap: wrap; gap: 1rem; }
  .wt-nav__links { gap: 1rem; }
}
`;
  return new Response(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
