-- ══════════════════════════════════════════════════════════════
-- SECURITY FIX: RLS hardening for vulnerable tables
-- Date: 2025-03-25
-- Risk: CRITICAL - 3 tables with RLS disabled, 2 tables with
--        open write policies allowing any user to modify data
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- FIX 1: Enable RLS on cache tables (currently wide open)
--
-- dart_cache, etf_holdings_snapshot, etf_changes are read-only
-- cache tables populated by server-side API routes using the
-- service role key (which bypasses RLS).
--
-- Strategy: Enable RLS, allow public SELECT, deny all writes
-- to anon/authenticated roles (service role bypasses RLS).
-- ──────────────────────────────────────────────────────────────

-- dart_cache
ALTER TABLE dart_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_dart_cache"
  ON dart_cache FOR SELECT
  USING (true);

-- etf_holdings_snapshot
ALTER TABLE etf_holdings_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_etf_holdings_snapshot"
  ON etf_holdings_snapshot FOR SELECT
  USING (true);

-- etf_changes
ALTER TABLE etf_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_etf_changes"
  ON etf_changes FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies = denied for anon & authenticated.
-- Service role (used by API routes) bypasses RLS entirely.


-- ──────────────────────────────────────────────────────────────
-- FIX 2: Lock down `prompts` table write policies
--
-- BEFORE: Any user (even anon) could INSERT, UPDATE, DELETE
--         all prompts via the Supabase client.
--
--   prompts_insert: WITH CHECK (true)  <-- CATASTROPHIC
--   prompts_update: USING (true)       <-- CATASTROPHIC
--   prompts_delete: USING (true)       <-- CATASTROPHIC
--
-- AFTER: Only service role can write. The API route at
--        /api/prompts already validates auth before calling
--        supabaseAdmin (service role) for writes.
-- ──────────────────────────────────────────────────────────────

-- Drop the dangerously permissive write policies
DROP POLICY IF EXISTS "prompts_insert" ON prompts;
DROP POLICY IF EXISTS "prompts_update" ON prompts;
DROP POLICY IF EXISTS "prompts_delete" ON prompts;

-- SELECT stays public (prompt library is public content)
-- "prompts_select" ON prompts FOR SELECT USING (true) already exists

-- Authenticated users can only modify their own prompts via RLS
-- (as a safety net behind the API route auth checks)
CREATE POLICY "prompts_insert_own"
  ON prompts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "prompts_update_own"
  ON prompts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "prompts_delete_own"
  ON prompts FOR DELETE
  USING (auth.uid() = author_id);


-- ──────────────────────────────────────────────────────────────
-- FIX 3: Lock down `predictions` table write policies
--
-- BEFORE: Any user (even anon) could INSERT or UPDATE
--         predictions via the Supabase client.
--
--   predictions_insert: WITH CHECK (true)  <-- DANGEROUS
--   predictions_update: USING (true)       <-- DANGEROUS
--
-- AFTER:
--   - SELECT stays public (leaderboard data)
--   - INSERT denied for anon/authenticated (admin-only via
--     service role in /api/predictions POST)
--   - UPDATE denied for anon/authenticated (resolution is
--     admin-only via service role in /api/predictions/[id]/resolve)
-- ──────────────────────────────────────────────────────────────

-- Drop the dangerously permissive write policies
DROP POLICY IF EXISTS "predictions_insert" ON predictions;
DROP POLICY IF EXISTS "predictions_update" ON predictions;

-- SELECT stays public
-- "predictions_select" ON predictions FOR SELECT USING (true) already exists

-- No INSERT/UPDATE/DELETE policies for regular users.
-- All writes go through API routes that use supabaseAdmin (service role).


COMMIT;
