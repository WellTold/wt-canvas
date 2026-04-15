-- Supabase Schema Documentation
-- This represents the ACTUAL table structure in your Supabase database

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
  content_json JSONB NOT NULL,
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
  content_json JSONB NOT NULL,
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
  content_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_articles_slug ON blog_articles(slug);
CREATE INDEX IF NOT EXISTS idx_blog_articles_status ON blog_articles(status);
CREATE INDEX IF NOT EXISTS idx_blog_articles_publish_date ON blog_articles(publish_date);

CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);
CREATE INDEX IF NOT EXISTS idx_landing_pages_publish_date ON landing_pages(publish_date);

CREATE INDEX IF NOT EXISTS idx_lead_magnets_slug ON lead_magnets(slug);
CREATE INDEX IF NOT EXISTS idx_lead_magnets_status ON lead_magnets(status);
CREATE INDEX IF NOT EXISTS idx_lead_magnets_publish_date ON lead_magnets(publish_date);