import { createTranslator, formatDate, type SupportedLocale } from '@evolai/i18n';
import { composeMessage } from './referentView';

export interface MessageFacts {
  /** Closing day (ISO) or null. */
  readonly closesOn: string | null;
  /** Contact person (engagement contact, else the referent), or null. */
  readonly contact: string | null;
  /** Estimated minutes to answer. */
  readonly minutes: number;
  /** The team's survey address, put after the line that introduces it in the reminder. */
  readonly address?: string;
}

export interface Prepared {
  readonly subject: string;
  readonly text: string;
}

/** Long, plain date for a message ("12 November 2026", "12 novembre 2026"). */
export const longDate = (locale: SupportedLocale, day: string): string =>
  formatDate(locale, `${day}T12:00:00Z`, { dateStyle: 'long' });

/**
 * The ready-made invitation and the one generic reminder, in one language (TASK-S). Pure: the
 * same facts give the same words, so the copy is unit-tested. Neither text names who answered.
 */
export const prepareMessages = (
  locale: SupportedLocale,
  facts: MessageFacts,
): { invite: Prepared; reminder: Prepared } => {
  const t = createTranslator(locale);
  const date = facts.closesOn ? longDate(locale, facts.closesOn) : '';
  const vars = { minutes: facts.minutes, date, contact: facts.contact ?? '' };
  const subject = t('client.invitations.subject');
  const invite = composeMessage(
    {
      greeting: t('client.invitations.message.greeting'),
      what: t('client.invitations.message.what'),
      time: t('client.invitations.message.time', vars),
      anonymous: t('client.invitations.message.anonymous'),
      closes: t('client.invitations.message.closes', vars),
      contact: t('client.invitations.message.contact', vars),
      thanks: t('client.invitations.message.thanks'),
    },
    facts,
  );
  const reminder = [
    t('client.invitations.reminder.greeting'),
    '',
    t('client.invitations.reminder.body', vars),
    facts.closesOn ? t('client.invitations.reminder.closes', vars) : null,
    t('client.invitations.reminder.link'),
    facts.address ?? null,
    facts.contact ? t('client.invitations.reminder.contact', vars) : null,
    '',
    t('client.invitations.reminder.thanks'),
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
  return { invite: { subject, text: invite }, reminder: { subject, text: reminder } };
};
