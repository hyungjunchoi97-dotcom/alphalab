CREATE TABLE IF NOT EXISTS legend_screener_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE legend_screener_cache ENABLE ROW LEVEL SECURITY;
