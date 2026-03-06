-- =====================================================
-- Community Board — Schema Migration v3
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Add image_url to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add parent_id to post_comments (for nested replies)
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES post_comments(id) ON DELETE CASCADE;

-- 3. Add likes column to post_comments
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS likes int DEFAULT 0;

-- 4. Update category CHECK constraint to allow new categories
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
  CHECK (category IN ('stock', 'crypto', 'overseas', 'macro', 'politics', 'discussion', 'idea', 'question', 'news', 'free'));

-- 5. Index for parent_id lookups
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id);
