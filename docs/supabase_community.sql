-- =====================================================
-- Community Board — Supabase schema (v2)
-- Run this in the Supabase SQL Editor (Dashboard → SQL)
-- =====================================================

-- 1. Posts table (replaces old community_posts)
CREATE TABLE IF NOT EXISTS posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  author_email text,
  title text NOT NULL,
  content text DEFAULT '',
  category text NOT NULL DEFAULT 'discussion'
    CHECK (category IN ('discussion', 'idea', 'question', 'news')),
  symbol text,
  likes int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Post comments
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_email text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Post likes (unique per user per post)
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  UNIQUE(user_id, post_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read comments" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Public read likes" ON post_likes FOR SELECT USING (true);

-- Authenticated insert
CREATE POLICY "Auth insert posts" ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth insert comments" ON post_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth insert likes" ON post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth delete likes" ON post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket (for image uploads, run only once)
-- Create a public bucket named "community" from the Supabase Dashboard:
--   Storage → New Bucket → name: "community", Public: ON
