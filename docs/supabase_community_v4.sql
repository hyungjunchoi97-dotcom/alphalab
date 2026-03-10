-- =====================================================
-- Community Board — Schema Migration v4
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Add subcategory to posts (for 종목토론방 sub-filters)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS subcategory text;

-- 2. Update category CHECK constraint to new 3-category system
--    Old categories (stock, crypto, overseas, politics, discussion, idea, question, news)
--    are kept for backward compat but new posts should use: stock_discussion, macro, free
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
  CHECK (category IN (
    'stock_discussion', 'macro', 'free',
    -- legacy (kept for existing data)
    'stock', 'crypto', 'overseas', 'politics', 'discussion', 'idea', 'question', 'news'
  ));

-- 3. Subcategory CHECK (nullable — only required for stock_discussion)
ALTER TABLE posts ADD CONSTRAINT posts_subcategory_check
  CHECK (subcategory IS NULL OR subcategory IN (
    'domestic', 'overseas', 'crypto', 'commodity', 'bond'
  ));
