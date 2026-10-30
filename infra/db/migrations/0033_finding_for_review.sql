-- 0033_finding_for_review.sql
--
-- ADR 0062: the auditor picks the findings the client's referent reviews (at most 7). Before this, the
-- referent had to judge every approved finding, keyword themes included (ESN pilot rehearsal,
-- 2026-10-30). With nothing picked, the app picks up to 7 itself. Forward only.

BEGIN;

ALTER TABLE findings ADD COLUMN IF NOT EXISTS for_review BOOLEAN NOT NULL DEFAULT false;

COMMIT;
