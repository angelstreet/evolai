/**
 * "Send and start your audit" (TASK-AH, ADR 0053): parse and format what the front page posts.
 * The answers come from a public visitor, so every field is checked here and free text is never
 * copied into the email until it has been through the anonymiser of a real engagement.
 */
export interface SendRequest {
  readonly email: string;
  readonly locale: 'en' | 'fr';
  /** question code -> chosen option index. Free-text answers only count, they are not kept. */
  readonly choices: Readonly<Record<string, number>>;
  readonly freeTextCount: number;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const CODE = /^v\d+_[a-z_]{1,60}$/;

export const parseSendRequest = (
  body: unknown,
  knownCodes: ReadonlySet<string>,
): SendRequest | null => {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const email = typeof b['email'] === 'string' ? b['email'].trim() : '';
  if (email.length > 254 || !EMAIL.test(email)) return null;
  const locale = b['locale'] === 'fr' ? 'fr' : 'en';
  const raw = b['answers'];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const choices: Record<string, number> = {};
  let freeTextCount = 0;
  for (const [code, value] of Object.entries(raw)) {
    if (!CODE.test(code) || !knownCodes.has(code)) return null;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 12) {
      choices[code] = value;
    } else if (typeof value === 'string' && value.trim() && value.length <= 400) {
      freeTextCount += 1;
    } else if (value !== '' && value !== null) {
      return null;
    }
  }
  return { email, locale, choices, freeTextCount };
};

export const formatOwnerMessage = (req: SendRequest): { subject: string; text: string } => ({
  subject: 'New audit request from the front page',
  text: [
    `Reply to: ${req.email}`,
    `Language: ${req.locale}`,
    `Choice answers: ${Object.keys(req.choices).length}`,
    `Free-text answers: ${req.freeTextCount} (not included; they are anonymised once an engagement exists)`,
    '',
    ...Object.entries(req.choices).map(([code, i]) => `${code}: option ${i + 1}`),
  ].join('\n'),
});
