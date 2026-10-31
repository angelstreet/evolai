'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { StatusText } from '@evolai/ui';
import type { RedactionTerm, TenantId } from '@evolai/contracts';
import type { SupportedLocale } from '@evolai/i18n';
import { formatDate } from '@evolai/i18n';
import { useI18n } from '@/components/I18nProvider';
import { addRedactionTermAction, removeRedactionTermAction } from './actions';
import { INITIAL_REDACTION_STATE, type RedactionActionState } from './state';

interface AuditRow {
  id: string;
  action: 'redaction_term.add' | 'redaction_term.remove';
  actorName: string;
  term: string;
  createdAt: string;
}

interface Props {
  tenantId: TenantId;
  terms: ReadonlyArray<RedactionTerm>;
  auditTrail: ReadonlyArray<AuditRow>;
  locale: SupportedLocale;
  emptyTitle: string;
}

function AddSubmit() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? t('admin.redaction.adding') : t('admin.redaction.add')}
    </button>
  );
}

function RemoveSubmit() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary" disabled={pending}>
      {pending ? t('admin.redaction.removing') : t('admin.redaction.remove')}
    </button>
  );
}

export function RedactionListClient({ tenantId, terms, auditTrail, locale, emptyTitle }: Props) {
  const fd = (iso: string): string => formatDate(locale, iso);
  const { t } = useI18n();
  const [addState, addAction] = useFormState<RedactionActionState, FormData>(
    addRedactionTermAction,
    INITIAL_REDACTION_STATE,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addState.ok) inputRef.current?.focus();
  }, [addState.ok, addState.message]);

  return (
    <div className="redaction-admin">
      <form action={addAction} className="form-row redaction-add">
        <input type="hidden" name="tenantId" value={tenantId} />
        <label htmlFor="redaction-term">{t('admin.redaction.termLabel')}</label>
        <input
          ref={inputRef}
          id="redaction-term"
          name="term"
          type="text"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          placeholder={t('admin.redaction.termPlaceholder')}
          aria-describedby="redaction-term-help"
          defaultValue={addState.term ?? ''}
        />
        <AddSubmit />
        {addState.message ? (
          <span className="status-msg" aria-live="polite">
            <StatusText status={addState.ok ? 'success' : 'error'}>{addState.message}</StatusText>
          </span>
        ) : null}
      </form>
      <p id="redaction-term-help" className="muted small">
        {t('admin.redaction.termHelp')}
      </p>

      {terms.length === 0 ? (
        <p className="muted" data-testid="redaction-empty">
          {emptyTitle}
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('admin.redaction.colTerm')}</th>
              <th scope="col">{t('admin.redaction.colAdded')}</th>
              <th scope="col">{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => (
              <RedactionRow key={term.id} tenantId={tenantId} term={term} formatDate={fd} />
            ))}
          </tbody>
        </table>
      )}

      <section aria-labelledby="redaction-audit-title" className="audit-trail">
        <h3 id="redaction-audit-title">
          {t('admin.redaction.auditTitle', { n: auditTrail.length })}
        </h3>
        {auditTrail.length === 0 ? (
          <p className="muted">{t('admin.redaction.noAudit')}</p>
        ) : (
          <ul className="card-list">
            {auditTrail.map((row) => (
              <li key={row.id} className="card audit-row">
                <span
                  className={`pill pill-${row.action === 'redaction_term.add' ? 'detected' : 'archived'}`}
                >
                  {row.action === 'redaction_term.add'
                    ? t('admin.redaction.actionAdd')
                    : t('admin.redaction.actionRemove')}
                </span>
                <strong>{row.term}</strong>
                <span className="muted small">
                  {fd(row.createdAt)} · {row.actorName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface RowProps {
  tenantId: TenantId;
  term: RedactionTerm;
  formatDate: (iso: string) => string;
}

function RedactionRow({ tenantId, term, formatDate }: RowProps) {
  const [state, action] = useFormState<RedactionActionState, FormData>(
    removeRedactionTermAction,
    INITIAL_REDACTION_STATE,
  );
  return (
    <tr>
      <td>
        <code className="muted">{term.term}</code>
      </td>
      <td>{formatDate(term.createdAt)}</td>
      <td>
        <form action={action} className="form-row">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="termId" value={term.id} />
          <RemoveSubmit />
          {state.message ? (
            <span className="status-msg" aria-live="polite">
              <StatusText status={state.ok ? 'success' : 'error'}>{state.message}</StatusText>
            </span>
          ) : null}
        </form>
      </td>
    </tr>
  );
}
