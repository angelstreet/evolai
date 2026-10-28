-- 0029_findings.sql
--
-- TASK-AJ A1 to A4 (ADR 0058): findings as their own engagement-level record, each resting on the
-- answers it cites, so the report's key findings and the catalogue's proposed actions come from the
-- answers again (the per-person analyses stay parked, ADR 0049).
--
--   * findings: one statement about a mission ("5 of 12 people paste client data as is"), written by
--     the auditor or proposed by a rule (`rule_key`, unique per mission so a rule proposes once).
--     Draft, approved or rejected; only approved findings cited by at least 5 people reach a report.
--     `tags` are the catalogue's evidence patterns the finding shows (they feed the matcher).
--   * finding_evidence: the answers a finding rests on. People = distinct submissions of those
--     answers. Erasing a person's answers removes their evidence rows (cascade).
--   * opportunity_findings: the approved findings an opportunity was made from.
--   * v1_repeat_time leaves the readiness score: hours on repeated tasks measure friction, not
--     maturity (more hours scored higher before). Weight 0 means "not scored" (ADR 0058).
--
-- Same RLS pattern as audit_reports. Additive, forward only. The app runs before and after it.

BEGIN;

SET LOCAL app.is_service_account = 'on';

CREATE TABLE findings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_id  UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  axis           TEXT NOT NULL CHECK (axis IN ('literacy', 'practice', 'readiness', 'opportunity', 'context')),
  label          TEXT NOT NULL CHECK (char_length(label) BETWEEN 3 AND 200),
  statement      TEXT NOT NULL DEFAULT '' CHECK (char_length(statement) <= 600),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  source         TEXT NOT NULL CHECK (source IN ('auditor', 'rule')),
  rule_key       TEXT CHECK (rule_key IS NULL OR rule_key ~ '^[a-z0-9_.:-]{3,80}$'),
  tags           TEXT[] NOT NULL DEFAULT '{}',
  created_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, rule_key)
);
CREATE INDEX findings_tenant_engagement_idx ON findings (tenant_id, engagement_id, created_at);

CREATE TABLE finding_evidence (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finding_id  UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  answer_id   UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  PRIMARY KEY (finding_id, answer_id)
);
CREATE INDEX finding_evidence_tenant_idx ON finding_evidence (tenant_id);
CREATE INDEX finding_evidence_answer_idx ON finding_evidence (answer_id);

CREATE TABLE opportunity_findings (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  finding_id      UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, finding_id)
);
CREATE INDEX opportunity_findings_tenant_idx ON opportunity_findings (tenant_id);
CREATE INDEX opportunity_findings_finding_idx ON opportunity_findings (finding_id);

ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings FORCE ROW LEVEL SECURITY;
ALTER TABLE finding_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE opportunity_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_findings FORCE ROW LEVEL SECURITY;

CREATE POLICY findings_select ON findings FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY findings_insert ON findings FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY findings_update ON findings FOR UPDATE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id())
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY findings_delete ON findings FOR DELETE USING (app_is_service_account());

CREATE POLICY finding_evidence_select ON finding_evidence FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY finding_evidence_insert ON finding_evidence FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY finding_evidence_delete ON finding_evidence FOR DELETE
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());

CREATE POLICY opportunity_findings_select ON opportunity_findings FOR SELECT
  USING (app_is_service_account() OR tenant_id = app_current_tenant_id());
CREATE POLICY opportunity_findings_insert ON opportunity_findings FOR INSERT
  WITH CHECK (app_is_service_account() OR tenant_id = app_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON findings TO auditai_app;
GRANT SELECT, INSERT, DELETE ON finding_evidence TO auditai_app;
GRANT SELECT, INSERT ON opportunity_findings TO auditai_app;

-- A4: hours on repeated tasks are a friction signal, not a maturity score.
UPDATE question_items
   SET scoring_json = jsonb_set(scoring_json, '{weight}', '0'::jsonb)
 WHERE code = 'v1_repeat_time';

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
      'answers.anonymise',
      'finding.create', 'finding.propose', 'finding.approve', 'finding.reject'
    ));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_target_kind_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_kind_check CHECK (target_kind IN (
      'analysis', 'opportunity', 'synergy', 'respondent_badge', 'export_request',
      'invitation', 'user', 'engagement', 'redaction_term', 'team', 'privacy_request',
      'report', 'report_step', 'tenant', 'finding'
    ));

COMMIT;
