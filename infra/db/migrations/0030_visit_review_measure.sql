-- 0030_visit_review_measure.sql
--
-- TASK-AJ A6, A8, A9 (ADR 0059): the visit, the referent's review and the day-90 measure.
--
--   * visit_notes (A6): dated notes the staff write during the visit (interview, observation or
--     workshop), optionally per team, anonymised on save by the app. Staff only: never shown to the
--     client, never in a published snapshot. Erased with the mission (cascade).
--   * finding_notes (A6): the visit notes a finding rests on, next to its answers. A finding can
--     rest on a note alone.
--   * finding_reviews (A8): the referent confirms or disputes an approved finding before the report
--     is published, with one line. A dispute blocks publishing until the auditor marks it
--     corrected or kept (with the dispute noted in the method).
--   * report_steps measure columns (A9): baseline value, unit and source, follow-up date and the
--     day-90 status (validated, mixed, no benefit, not implemented). PRD §30.1 minimum.
--
-- Same RLS pattern as findings. Additive, forward only. The app runs before and after it.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE visit_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id  UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  team_id        UUID REFERENCES teams(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('interview', 'observation', 'workshop')),
  noted_on       DATE NOT NULL,
  body           TEXT NOT NULL CHECK (char_length(body) BETWEEN 3 AND 2000),
  created_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX visit_notes_tenant_engagement_idx ON visit_notes (tenant_id, engagement_id, noted_on);

CREATE TABLE finding_notes (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finding_id  UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  note_id     UUID NOT NULL REFERENCES visit_notes(id) ON DELETE CASCADE,
  PRIMARY KEY (finding_id, note_id)
);
CREATE INDEX finding_notes_tenant_idx ON finding_notes (tenant_id);
CREATE INDEX finding_notes_note_idx ON finding_notes (note_id);

CREATE TABLE finding_reviews (
  finding_id   UUID PRIMARY KEY REFERENCES findings(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  verdict      TEXT NOT NULL CHECK (verdict IN ('confirmed', 'disputed')),
  comment      TEXT NOT NULL DEFAULT '' CHECK (char_length(comment) <= 300),
  reviewed_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolution   TEXT CHECK (resolution IN ('corrected', 'kept')),
  resolved_by  UUID REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX finding_reviews_tenant_idx ON finding_reviews (tenant_id);

ALTER TABLE visit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE finding_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE finding_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY visit_notes_select ON visit_notes FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY visit_notes_insert ON visit_notes FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY visit_notes_delete ON visit_notes FOR DELETE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());

CREATE POLICY finding_notes_select ON finding_notes FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY finding_notes_insert ON finding_notes FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY finding_notes_delete ON finding_notes FOR DELETE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());

CREATE POLICY finding_reviews_select ON finding_reviews FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY finding_reviews_insert ON finding_reviews FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY finding_reviews_update ON finding_reviews FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());

GRANT SELECT, INSERT, DELETE ON visit_notes TO auditai_app;
GRANT SELECT, INSERT, DELETE ON finding_notes TO auditai_app;
GRANT SELECT, INSERT, UPDATE ON finding_reviews TO auditai_app;

ALTER TABLE report_steps
  ADD COLUMN baseline_value  NUMERIC CHECK (baseline_value IS NULL OR baseline_value >= 0),
  ADD COLUMN baseline_unit   TEXT NOT NULL DEFAULT '' CHECK (char_length(baseline_unit) <= 40),
  ADD COLUMN baseline_source TEXT NOT NULL DEFAULT '' CHECK (char_length(baseline_source) <= 200),
  ADD COLUMN follow_up_on    DATE,
  ADD COLUMN day90_status    TEXT CHECK (day90_status IN ('validated', 'mixed', 'no_benefit', 'not_implemented'));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (action IN (
      'analysis.approve', 'analysis.reject',
      'opportunity.create', 'opportunity.update', 'opportunity.archive',
      'synergy.detect', 'synergy.surface', 'synergy.dismiss', 'synergy.archive',
      'export.complete', 'badge.erase', 'pseudonym.erase',
      'user.create', 'user.set_password', 'user.disable',
      'invitation.create_batch', 'invitation.export', 'invitation.revoke',
      'invitation.extend', 'invitation.regenerate', 'invitation.remind',
      'invitation.purge_addresses', 'invitation.settings',
      'view_as.start', 'view_as.stop', 'view_as.request', 'view_as.refused',
      'client.seed', 'user.set_email',
      'redaction_term.add', 'redaction_term.remove',
      'engagement.create', 'engagement.update', 'engagement.launch', 'engagement.close',
      'team.create', 'team.update', 'invitation.revoke_batch',
      'referent.invite', 'password.set', 'password.reset_request', 'password.reset',
      'privacy.update', 'privacy_request.create', 'privacy_request.handle',
      'report.create', 'report.update', 'report.suggest', 'report.plan',
      'report.submit', 'report.publish', 'report.unpublish', 'report.new_version',
      'report.ai_draft', 'report.export',
      'report_step.add', 'report_step.update', 'report_step.accept', 'report_step.reject',
      'report_step.measure',
      'answers.anonymise',
      'finding.create', 'finding.propose', 'finding.approve', 'finding.reject',
      'finding.confirm', 'finding.dispute', 'finding.resolve',
      'visit_note.create', 'visit_note.delete'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request',
      'invitation', 'user', 'engagement', 'redaction_term', 'team', 'privacy_request',
      'report', 'report_step', 'tenant', 'finding', 'visit_note'
    ));

COMMIT;
