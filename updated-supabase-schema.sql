
-- Updated Supabase Schema for Markdown Content Storage
-- Changes: content_json (JSONB) -> content_markdown (TEXT) + content_html (TEXT)

-- Blog Articles Table
CREATE TABLE blog_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  meta_description TEXT,
  image_url TEXT,
  publish_date DATE,
  revision_date DATE,
  post_type TEXT DEFAULT 'blog',
  tags TEXT[] DEFAULT '{}',
  cta_text TEXT,
  cta_link TEXT,
  author_name TEXT,
  author_avatar_url TEXT,
  status TEXT DEFAULT 'draft',
  approval_status TEXT DEFAULT 'pending',
  editor_notes TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landing Pages Table
CREATE TABLE landing_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  meta_description TEXT,
  image_url TEXT,
  publish_date DATE,
  revision_date DATE,
  page_type TEXT DEFAULT 'landing_page',
  tags TEXT[] DEFAULT '{}',
  cta_text TEXT,
  cta_link TEXT,
  author_name TEXT,
  author_avatar_url TEXT,
  status TEXT DEFAULT 'draft',
  approval_status TEXT DEFAULT 'pending',
  editor_notes TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead Magnets Table
CREATE TABLE lead_magnets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  meta_description TEXT,
  image_url TEXT,
  publish_date DATE,
  revision_date DATE,
  magnet_type TEXT DEFAULT 'lead_magnet',
  tags TEXT[] DEFAULT '{}',
  cta_text TEXT,
  cta_link TEXT,
  author_name TEXT,
  author_avatar_url TEXT,
  status TEXT DEFAULT 'draft',
  approval_status TEXT DEFAULT 'pending',
  editor_notes TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration script to update existing tables
-- Run these commands in your Supabase SQL editor:

-- For blog_articles
ALTER TABLE blog_articles 
ADD COLUMN content_markdown TEXT,
ADD COLUMN content_html TEXT;

-- For landing_pages  
ALTER TABLE landing_pages 
ADD COLUMN content_markdown TEXT,
ADD COLUMN content_html TEXT;

-- For lead_magnets
ALTER TABLE lead_magnets 
ADD COLUMN content_markdown TEXT,
ADD COLUMN content_html TEXT;

-- After adding the columns and migrating data, you can drop content_json:
-- ALTER TABLE blog_articles DROP COLUMN content_json;
-- ALTER TABLE landing_pages DROP COLUMN content_json; 
-- ALTER TABLE lead_magnets DROP COLUMN content_json;

-- Indexes for performance (keep existing indexes)
CREATE INDEX IF NOT EXISTS idx_blog_articles_slug ON blog_articles(slug);
CREATE INDEX IF NOT EXISTS idx_blog_articles_status ON blog_articles(status);
CREATE INDEX IF NOT EXISTS idx_blog_articles_publish_date ON blog_articles(publish_date);

CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);
CREATE INDEX IF NOT EXISTS idx_landing_pages_publish_date ON landing_pages(publish_date);

CREATE INDEX IF NOT EXISTS idx_lead_magnets_slug ON lead_magnets(slug);
CREATE INDEX IF NOT EXISTS idx_lead_magnets_status ON lead_magnets(status);
CREATE INDEX IF NOT EXISTS idx_lead_magnets_publish_date ON lead_magnets(publish_date);
