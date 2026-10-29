-- 0032_follow_up_value.sql
--
-- ADR 0061: the day-90 follow-up records the value measured on the follow-up date, next to the
-- baseline, so the report can say "before → after". One nullable column; the app shows the field
-- only once this is applied. Forward only.

BEGIN;

ALTER TABLE report_steps ADD COLUMN IF NOT EXISTS follow_up_value NUMERIC
  CHECK (follow_up_value IS NULL OR follow_up_value >= 0);

COMMIT;
