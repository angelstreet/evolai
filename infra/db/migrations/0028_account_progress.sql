-- 0028_account_progress.sql
--
-- TASK-AI L1 (ADR 0056): the front page's "Your path" for a signed-in account, so a second device
-- shows the same steps. One row per user: which of the five lessons are done, whether the survey was
-- finished and when the answers were sent. No answer and no tenant data is stored here; the sent
-- answers stay an anonymous response that refers to no account (ADR 0055).
--
-- Only the service account reads and writes it (the route checks the session). Additive, forward only.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE account_progress (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lessons_seen SMALLINT[] NOT NULL DEFAULT '{}'
               CHECK (lessons_seen <@ ARRAY[0, 1, 2, 3, 4]::SMALLINT[]),
  survey_done  BOOLEAN NOT NULL DEFAULT false,
  sent_at      TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY account_progress_service ON account_progress FOR ALL
  USING (app_is_service_account()) WITH CHECK (app_is_service_account());

GRANT SELECT, INSERT, UPDATE ON account_progress TO auditai_app;

COMMIT;
