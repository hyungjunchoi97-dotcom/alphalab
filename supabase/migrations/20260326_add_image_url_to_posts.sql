-- Ensure image_url column exists on posts table.
-- Originally defined in docs/supabase_community_v3.sql but may not have been applied.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
