# WT Pages Worker

Cloudflare Worker that serves public SEO pages at `welltold.design/pages`. It reads live content from Supabase and renders full HTML pages with proper meta tags, Open Graph tags, and JSON-LD structured data.

## How it works

```
User → welltold.design/pages/my-slug → Cloudflare Worker → Supabase (live rows) → HTML page
```

The worker:
- Strips the `/pages/` prefix from incoming paths, then looks up the slug in `blog_articles`, `landing_pages`, `lead_magnets` (status = 'live')
- Renders the `content_json` blocks to semantic HTML
- Injects meta, OG, Twitter card, and JSON-LD into the `<head>`
- Serves `/pages/sitemap.xml` dynamically
- Handles `redirect_from` arrays for 301 redirects

## First-time setup

**Prerequisites**: Node.js + npm installed locally, Cloudflare account with the `welltold.design` zone.

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

Then in Cloudflare dashboard, add a **Route** on the `welltold.design` zone matching `welltold.design/pages/*` → `wt-pages-worker`.

## Environment variables

- `SITE_BASE_URL` = `https://welltold.design/pages` (set in wrangler.toml, not a secret)
- `SUPABASE_URL` — secret
- `SUPABASE_ANON_KEY` — secret

## Cache purging

When WT Canvas publishes an article, it calls the Cloudflare Cache Purge API automatically (requires `CF_API_TOKEN` and `CF_ZONE_ID` secrets on Replit). Until `CF_ZONE_ID` is set, publish still succeeds — cache purge is just skipped with a warning.

## Local development

```bash
npm run dev
# Worker runs at http://localhost:8787/pages/<slug>
```
