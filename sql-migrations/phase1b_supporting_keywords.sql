-- Phase 1B: Add supporting_keywords column to Supabase content tables
-- Run this in the Supabase SQL editor (https://app.supabase.com → SQL Editor)
-- Safe to run multiple times — uses IF NOT EXISTS

-- blog_articles
ALTER TABLE blog_articles
  ADD COLUMN IF NOT EXISTS supporting_keywords TEXT;

-- landing_pages
ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS supporting_keywords TEXT;

-- lead_magnets
ALTER TABLE lead_magnets
  ADD COLUMN IF NOT EXISTS supporting_keywords TEXT;
