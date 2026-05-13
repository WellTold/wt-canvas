-- Phase 2A: image_templates table
-- Run this in the Supabase SQL editor (https://app.supabase.com → SQL Editor) AND on the local/dev DB if needed.
-- Safe to run multiple times — uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS image_templates (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  thumbnail_url       TEXT,
  prompt              TEXT NOT NULL,
  model               TEXT NOT NULL DEFAULT 'bana-pro/text-to-image',
  reference_image_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
