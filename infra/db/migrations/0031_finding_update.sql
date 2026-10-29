-- 0031_finding_update.sql
--
-- ADR 0060: the auditor can reword a finding (title, sentence, axis) after a dispute or a review,
-- instead of withdrawing it and writing it again. One new audit verb, `finding.update`; the app
-- offers editing only once this is applied. Forward only.

BEGIN;

SET LOCAL app.is_service_account = 'on';

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
      'finding.confirm', 'finding.dispute', 'finding.resolve', 'finding.update',
      'visit_note.create', 'visit_note.delete'
    ));

COMMIT;
