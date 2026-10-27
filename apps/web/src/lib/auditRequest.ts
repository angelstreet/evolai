import { resolve4, resolve6, resolveMx } from 'node:dns/promises';

/**
 * "Ask for an audit" from the front page (TASK-AI L6). A visitor gives one thing, an email
 * address; it must be valid: the right shape, and a domain that accepts mail (an MX record, or an
 * address record, which mail servers fall back to). Asking again is allowed; each request reaches
 * the owner by email. No account is created.
 */
const EMAIL = /^[^\s@]{1,64}@([^\s@.]{1,63}\.)+[A-Za-z]{2,63}$/;

export const parseEmail = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const email = raw.trim();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
};

export type MailCheck = 'ok' | 'no_mail' | 'unknown';

export interface Resolver {
  mx(domain: string): Promise<unknown[]>;
  a(domain: string): Promise<unknown[]>;
}

const DNS: Resolver = {
  mx: (d) => resolveMx(d),
  a: async (d) => [...(await resolve4(d).catch(() => [])), ...(await resolve6(d).catch(() => []))],
};

const NO_SUCH = new Set(['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'EBADNAME', 'ENONAME']);

/** Does the domain accept mail? `unknown` when DNS itself failed: never blame the visitor for it. */
export const domainAcceptsMail = async (
  email: string,
  resolver: Resolver = DNS,
  timeoutMs = 3000,
): Promise<MailCheck> => {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  // RFC 2606: `.invalid` never takes mail, and tests use it without a network.
  if (domain.endsWith('.invalid')) return 'no_mail';
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), timeoutMs));
  const check = (async (): Promise<MailCheck> => {
    try {
      if ((await resolver.mx(domain)).length > 0) return 'ok';
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (!NO_SUCH.has(code)) return 'unknown';
    }
    return (await resolver.a(domain)).length > 0 ? 'ok' : 'no_mail';
  })();
  const out = await Promise.race([check, timeout]);
  return out === 'timeout' ? 'unknown' : out;
};

export const formatOwnerMessage = (email: string, locale: 'en' | 'fr') => ({
  subject: 'Audit request from the front page',
  text: [`Reply to: ${email}`, `Language: ${locale}`].join('\n'),
});
