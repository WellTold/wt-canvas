-- Phase 1A: Add SEO columns to Supabase content tables
-- Run this in the Supabase SQL editor (https://app.supabase.com → SQL Editor)
-- Safe to run multiple times — uses IF NOT EXISTS

-- blog_articles
ALTER TABLE blog_articles
  ADD COLUMN IF NOT EXISTS og_image        TEXT,
  ADD COLUMN IF NOT EXISTS og_title        TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url   TEXT,
  ADD COLUMN IF NOT EXISTS page_template   TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS structured_data JSONB,
  ADD COLUMN IF NOT EXISTS custom_css      TEXT,
  ADD COLUMN IF NOT EXISTS redirect_from   TEXT[],
  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ;

-- landing_pages
ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS og_image        TEXT,
  ADD COLUMN IF NOT EXISTS og_title        TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url   TEXT,
  ADD COLUMN IF NOT EXISTS page_template   TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS structured_data JSONB,
  ADD COLUMN IF NOT EXISTS custom_css      TEXT,
  ADD COLUMN IF NOT EXISTS redirect_from   TEXT[],
  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ;

-- lead_magnets
ALTER TABLE lead_magnets
  ADD COLUMN IF NOT EXISTS og_image        TEXT,
  ADD COLUMN IF NOT EXISTS og_title        TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url   TEXT,
  ADD COLUMN IF NOT EXISTS page_template   TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS structured_data JSONB,
  ADD COLUMN IF NOT EXISTS custom_css      TEXT,
  ADD COLUMN IF NOT EXISTS redirect_from   TEXT[],
  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ;

-- Grant read access to the anon key (for Cloudflare Worker public reads)
GRANT SELECT ON blog_articles  TO anon;
GRANT SELECT ON landing_pages  TO anon;
GRANT SELECT ON lead_magnets   TO anon;

-- RLS: allow public read of live pages (Worker uses Supabase anon key)
-- Only needed if RLS is enabled on these tables.
-- Run these if you get 403 errors from the Worker.

-- DROP POLICY IF EXISTS "Public can read live articles" ON blog_articles;
-- CREATE POLICY "Public can read live articles"
--   ON blog_articles FOR SELECT
--   USING (status = 'live');

-- DROP POLICY IF EXISTS "Public can read live pages" ON landing_pages;
-- CREATE POLICY "Public can read live pages"
--   ON landing_pages FOR SELECT
--   USING (status = 'live');

-- DROP POLICY IF EXISTS "Public can read live magnets" ON lead_magnets;
-- CREATE POLICY "Public can read live magnets"
--   ON lead_magnets FOR SELECT
--   USING (status = 'live');
