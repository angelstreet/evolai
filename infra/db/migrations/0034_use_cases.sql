-- 0034_use_cases.sql
--
-- ADR 0064: the report is built on use cases. An opportunity can now be a use case from the playbook
-- (`use_case_id`), carry what the auditor measured during the visit (`qualification_json`: volume a
-- week, minutes per unit, teams, source) and the client's referent's order of priority
-- (`client_rank`). Audit verb `opportunity.update` records both. Forward only.

BEGIN;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS use_case_id TEXT
  CHECK (use_case_id IS NULL OR use_case_id ~ '^uc\.[a-z0-9_]+$');
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS qualification_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS client_rank INTEGER
  CHECK (client_rank IS NULL OR client_rank BETWEEN 1 AND 20);

-- One opportunity per use case and mission.
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_use_case_uniq
  ON opportunities (engagement_id, use_case_id) WHERE use_case_id IS NOT NULL;

COMMIT;
