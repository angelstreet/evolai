-- 0035_mission_kind.sql
--
-- ADR 0065 (TASK-AK): two audit types. `kind` says what the mission audits: a team's tasks or the
-- company's AI governance. `mode` says how a team audit collects answers: an auditor interview or a
-- self-serve survey. A governance audit is always an interview. Existing missions are team surveys,
-- which is what they were. Forward only; the app reads both columns with a fallback before it runs.

BEGIN;

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'team'
  CHECK (kind IN ('team', 'governance'));
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'survey'
  CHECK (mode IN ('interview', 'survey'));

ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_governance_is_interview;
ALTER TABLE engagements ADD CONSTRAINT engagements_governance_is_interview
  CHECK (kind <> 'governance' OR mode = 'interview');

COMMIT;
