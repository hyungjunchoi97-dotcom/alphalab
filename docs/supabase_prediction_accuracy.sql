-- Prediction Accuracy Tracking Schema
-- Run this AFTER the base predictions schema (docs/supabase_predictions.sql)

-- 1. Add resolved_at to predictions table
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- 2. Create view for user prediction stats (leaderboard)
CREATE OR REPLACE VIEW user_prediction_stats AS
SELECT
  pv.user_id,
  COUNT(*)::int AS total_predictions,
  COUNT(*) FILTER (
    WHERE p.resolved_option_id IS NOT NULL
      AND pv.option_id = p.resolved_option_id
  )::int AS correct_predictions,
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(
        COUNT(*) FILTER (
          WHERE p.resolved_option_id IS NOT NULL
            AND pv.option_id = p.resolved_option_id
        )::numeric / COUNT(*)::numeric * 100, 1
      )
    ELSE 0
  END AS accuracy_rate,
  RANK() OVER (
    ORDER BY
      COUNT(*) FILTER (
        WHERE p.resolved_option_id IS NOT NULL
          AND pv.option_id = p.resolved_option_id
      )::numeric / GREATEST(COUNT(*)::numeric, 1) DESC,
      COUNT(*) DESC
  )::int AS rank
FROM prediction_votes pv
JOIN predictions p ON p.id = pv.prediction_id
WHERE p.status = 'resolved'
GROUP BY pv.user_id;
