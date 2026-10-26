-- 0026_team_addresses.sql
--
-- TASK-AF (ADR 0051): one survey address per team, and the "Open my space" sign-in token.
--
--   * team_addresses: one row per team of an engagement. `slug` is the public part of the address
--     (`/s/<slug>`), lower-case ASCII, unique across the platform. `expected_size` is the team
--     size the referent states; it only feeds the "N of M answered" line.
--   * auth_tokens.kind gains 'space': single use, 30 days, opens the referent's space without a
--     password.
--
-- Same RLS pattern as invitations. Forward only.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE team_addresses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id  UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 60),
  expected_size  INTEGER CHECK (expected_size IS NULL OR expected_size BETWEEN 1 AND 100000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug),
  UNIQUE (engagement_id, team_id)
);
CREATE INDEX team_addresses_tenant_idx ON team_addresses (tenant_id);

ALTER TABLE team_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_addresses FORCE ROW LEVEL SECURITY;
CREATE POLICY team_addresses_select ON team_addresses FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY team_addresses_insert ON team_addresses FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY team_addresses_update ON team_addresses FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY team_addresses_delete ON team_addresses FOR DELETE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON team_addresses TO auditai_app;

ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_kind_check;
ALTER TABLE auth_tokens
  ADD CONSTRAINT auth_tokens_kind_check CHECK (kind IN ('invite', 'reset', 'space'));

COMMIT;
