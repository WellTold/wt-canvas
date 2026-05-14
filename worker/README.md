# WT Pages Worker

Cloudflare Worker that serves public SEO pages at `welltolddesign.com/articles`. It reads live content from Supabase and renders full HTML pages with proper meta tags, Open Graph tags, and JSON-LD structured data.

## How it works

```
User → welltolddesign.com/articles/my-slug → Cloudflare Worker → Supabase (live rows) → HTML page
```

The worker:
- Strips the `/articles/` prefix from incoming paths, then looks up the slug in `blog_articles`, `landing_pages`, `lead_magnets` (status = 'live')
- Renders the `content_markdown` (or `content_json`) to semantic HTML
- Injects a hero image (`featured_image`) below the first H1
- Injects meta, OG, Twitter card, and JSON-LD into the `<head>`
- Injects FAQ accordion, inline CTA, and Shopify product cards from `structured_data`
- Serves `/articles/sitemap.xml` dynamically
- Handles `redirect_from` arrays for 301 redirects

## First-time setup

**Prerequisites**: Node.js + npm installed locally, Cloudflare account with the `welltolddesign.com` zone.

```bash
cd worker
npm install
```

### Set secrets

```bash
wrangler secret put SUPABASE_URL
# paste: https://<your-project>.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# paste: <your anon key>
```

### Deploy

```bash
npm run deploy
```

Then in Cloudflare dashboard, add a **Route** on the `welltolddesign.com` zone matching `welltolddesign.com/articles/*` → `wt-pages-worker`.

## Redeploying after source changes

**Any change to files under `worker/src/` requires a manual redeploy** — the live Cloudflare Worker is a separate, independently deployed artifact from the Replit app. Changes in this repo do not go live automatically.

```bash
cd worker
npm run deploy
```

### Recent changes that require a redeploy

The following features are implemented in source but only take effect once the worker is redeployed:

| Feature | File | What it does |
|---------|------|---|
| Hero image injection | `src/renderer/blockToHtml.ts:986-997` | Injects `<div class="wt-hero-image"><img>` after the first `</h1>` using `featured_image` from Supabase |
| Hero image CSS | `src/index.ts:704-705` | `.wt-hero-image` + `.wt-hero-image img` rules (full-width, max-height 480px, object-fit cover) |
| FAQ accordion | `src/renderer/blockToHtml.ts` | Renders `_wt_faq` structured data as an interactive `<details>` accordion |
| Inline CTA | `src/renderer/blockToHtml.ts` | Injects `_wt_cta` copy after the 2nd H2 |
| Shopify product grid | `src/renderer/blockToHtml.ts` | Renders `_wt_products` as a mini product card grid |

## Environment variables

- `SITE_BASE_URL` = `https://welltolddesign.com` (set in wrangler.toml, not a secret)
- `SUPABASE_URL` — secret
- `SUPABASE_ANON_KEY` — secret

## Cache purging

When WT Canvas publishes an article, it calls the Cloudflare Cache Purge API automatically (requires `CF_API_TOKEN` and `CF_ZONE_ID` secrets on Replit). Until `CF_ZONE_ID` is set, publish still succeeds — cache purge is just skipped with a warning.

The cache purge targets the article's full slug URL (`/a/articles/<slug>`, `/articles/<slug>`) so the updated HTML is served immediately after publish.

## Verifying a deployment

After deploying, open a published article and check View Source:

- Look for `<div class="wt-hero-image">` — confirms hero injection is live
- Look for `<meta name="description"` — confirms meta description is synced
- Look for `wt-accordion` — confirms FAQ rendering is live

To force-bypass Cloudflare's cache during a manual check, append `?nocache=1` (the worker does not cache-bust on query strings, but Cloudflare may skip the cache layer for unique URLs during testing).

## Local development

```bash
npm run dev
# Worker runs at http://localhost:8787/articles/<slug>
```
