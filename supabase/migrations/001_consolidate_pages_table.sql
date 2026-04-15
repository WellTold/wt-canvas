-- Migration: Consolidate blog_articles, landing_pages, lead_magnets → pages
-- Run this against your Supabase project via the SQL editor or Supabase CLI.

-- 1. Create the unified pages table
CREATE TABLE IF NOT EXISTS pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type    text NOT NULL CHECK (content_type IN ('blog_article', 'landing_page', 'lead_magnet')),
  title           text NOT NULL DEFAULT '',
  slug            text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'draft',
  approval_status text NOT NULL DEFAULT 'pending',
  author_name     text,
  publish_date    date,
  published_at    timestamptz,
  meta_description    text,
  primary_keyword     text,
  supporting_keywords text,
  featured_image      text,
  og_image            text,
  og_title            text,
  canonical_url       text,
  page_template       text DEFAULT 'default',
  structured_data     jsonb,
  custom_css          text,
  redirect_from       text[],
  tags                text[],
  content_json        jsonb,
  content_markdown    text,
  content_html        text,
  scheduled_publish_date timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Migrate data from blog_articles
INSERT INTO pages (
  content_type, title, slug, status, approval_status, author_name, publish_date, published_at,
  meta_description, primary_keyword, supporting_keywords, featured_image,
  og_image, og_title, canonical_url, page_template, structured_data, custom_css,
  redirect_from, tags, content_json, content_markdown, content_html,
  scheduled_publish_date, created_at, updated_at
)
SELECT
  'blog_article' AS content_type,
  title, slug, status, COALESCE(approval_status, 'pending'), author_name, publish_date, published_at,
  meta_description, primary_keyword, supporting_keywords, featured_image,
  og_image, og_title, canonical_url, page_template, structured_data, custom_css,
  redirect_from, tags, content_json, content_markdown, content_html,
  scheduled_publish_date, created_at, updated_at
FROM blog_articles;

-- 3. Migrate data from landing_pages
INSERT INTO pages (
  content_type, title, slug, status, approval_status, author_name, publish_date, published_at,
  meta_description, primary_keyword, supporting_keywords, featured_image,
  og_image, og_title, canonical_url, page_template, structured_data, custom_css,
  redirect_from, tags, content_json, content_markdown, content_html,
  scheduled_publish_date, created_at, updated_at
)
SELECT
  'landing_page' AS content_type,
  title, slug, status, COALESCE(approval_status, 'pending'), author_name, publish_date, published_at,
  meta_description, primary_keyword, supporting_keywords, featured_image,
  og_image, og_title, canonical_url, page_template, structured_data, custom_css,
  redirect_from, tags, content_json, content_markdown, content_html,
  scheduled_publish_date, created_at, updated_at
FROM landing_pages;

-- 4. Migrate data from lead_magnets
INSERT INTO pages (
  content_type, title, slug, status, approval_status, author_name, publish_date, published_at,
  meta_description, primary_keyword, supporting_keywords, featured_image,
  og_image, og_title, canonical_url, page_template, structured_data, custom_css,
  redirect_from, tags, content_json, content_markdown, content_html,
  scheduled_publish_date, created_at, updated_at
)
SELECT
  'lead_magnet' AS content_type,
  title, slug, status, COALESCE(approval_status, 'pending'), author_name, publish_date, published_at,
  meta_description, primary_keyword, supporting_keywords, featured_image,
  og_image, og_title, canonical_url, page_template, structured_data, custom_css,
  redirect_from, tags, content_json, content_markdown, content_html,
  scheduled_publish_date, created_at, updated_at
FROM lead_magnets;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS pages_content_type_idx ON pages (content_type);
CREATE INDEX IF NOT EXISTS pages_status_idx ON pages (status);
CREATE INDEX IF NOT EXISTS pages_slug_idx ON pages (slug);
CREATE INDEX IF NOT EXISTS pages_updated_at_idx ON pages (updated_at DESC);

-- NOTE: The old tables (blog_articles, landing_pages, lead_magnets) are intentionally
-- left in place for rollback safety. Drop them manually after verifying the migration:
--   DROP TABLE blog_articles;
--   DROP TABLE landing_pages;
--   DROP TABLE lead_magnets;
