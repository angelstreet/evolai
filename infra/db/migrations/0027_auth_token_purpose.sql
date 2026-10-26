-- 0027_auth_token_purpose.sql
--
-- TASK-AF (ADR 0051): the "Open my space" sign-in token. Additive only: a `purpose` column tells a
-- token that opens a referent's space ('space') from one that sets a password ('password', the
-- default for every existing row). Space tokens are stored with kind 'invite'. A set-password
-- route only accepts purpose 'password'; the space route only accepts purpose 'space'.
--
-- Forward only.

BEGIN;

SET LOCAL app.is_service_account = 'on';

ALTER TABLE auth_tokens
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'password' CHECK (purpose IN ('password', 'space'));

COMMIT;
