-- Phase 0A: Create profiles table linked to auth.users
-- Run this in the Supabase SQL editor (https://app.supabase.com → SQL Editor)
-- Run BEFORE starting the app for the first time.

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  first_name  TEXT,
  last_name   TEXT,
  display_name TEXT,
  avatar_url  TEXT,
  initials    TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'editor',
  default_theme TEXT NOT NULL DEFAULT 'light',
  background_color TEXT NOT NULL DEFAULT '#f0ebe7',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: users can only read/update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can do everything (for seeding and admin)
CREATE POLICY "Service role full access"
  ON public.profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, initials, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'initials', UPPER(LEFT(NEW.email, 2))),
    COALESCE(NEW.raw_user_meta_data->>'role', 'editor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing auth.users
INSERT INTO public.profiles (id, email, name, initials, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', u.email),
  COALESCE(u.raw_user_meta_data->>'initials', UPPER(LEFT(u.email, 2))),
  COALESCE(u.raw_user_meta_data->>'role', 'editor')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
