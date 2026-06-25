-- Migration: add html_snapshot column to templates table
-- Run in Supabase SQL editor. Safe to run multiple times.
ALTER TABLE templates ADD COLUMN IF NOT EXISTS html_snapshot TEXT;
