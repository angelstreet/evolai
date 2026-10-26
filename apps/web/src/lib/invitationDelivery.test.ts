import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptAddress,
  encryptAddress,
  isPlausibleEmail,
  resolveEmailKey,
} from './invitationCrypto';
import {
  BrevoEmailProvider,
  EmailNotConfigured,
  MockEmailProvider,
  resolveEmailProvider,
} from './emailProvider';
import { buildMessage, sendInvitationEmails } from './invitationDelivery';

const key = randomBytes(32);
const ID = '11111111-1111-4111-8111-111111111111';

describe('address encryption', () => {
  it('round-trips and never contains the address in the ciphertext', () => {
    const c = encryptAddress('person@synthetic.invalid', ID, key);
    expect(c).not.toContain('person');
    expect(decryptAddress(c, ID, key)).toBe('person@synthetic.invalid');
  });
  it('is bound to the invitation id and to the key', () => {
    const c = encryptAddress('person@synthetic.invalid', ID, key);
    expect(() => decryptAddress(c, '22222222-2222-4222-8222-222222222222', key)).toThrow();
    expect(() => decryptAddress(c, ID, randomBytes(32))).toThrow();
  });
  it('fails closed without a valid key', () => {
    expect(() => resolveEmailKey({})).toThrow(/INVITE_EMAIL_KEY/);
    expect(() => resolveEmailKey({ INVITE_EMAIL_KEY: 'c2hvcnQ' })).toThrow();
    expect(resolveEmailKey({ INVITE_EMAIL_KEY: key.toString('base64') })).toHaveLength(32);
  });
  it('rejects obviously bad addresses', () => {
    expect(isPlausibleEmail('a@synthetic.invalid')).toBe(true);
    expect(isPlausibleEmail('a b@synthetic.invalid')).toBe(false);
    expect(isPlausibleEmail('a@synthetic.invalid, c@synthetic.invalid')).toBe(false);
  });
});

describe('email provider', () => {
  it('fails closed when unconfigured, and the mock is never used in production', () => {
    expect(() => resolveEmailProvider({})).toThrow(EmailNotConfigured);
    expect(() => resolveEmailProvider({ EMAIL_PROVIDER: 'brevo' })).toThrow(EmailNotConfigured);
    expect(() => resolveEmailProvider({ EMAIL_PROVIDER: 'mock', NODE_ENV: 'production' })).toThrow(
      EmailNotConfigured,
    );
    expect(resolveEmailProvider({ EMAIL_PROVIDER: 'mock' }).name).toBe('mock');
  });
  it('the Brevo adapter posts a plain-text message with the key in a header only', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const p = new BrevoEmailProvider({
      apiKey: 'test-key-not-real',
      from: 'noreply@synthetic.invalid',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response('{}', { status: 201 });
      }) as unknown as typeof fetch,
    });
    await p.send({ to: 'person@synthetic.invalid', subject: 's', text: 't' });
    expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(String(calls[0]?.init.body)).not.toContain('test-key-not-real');
  });
  it('a rejected send is counted, not thrown, and messages carry the link in the right language', async () => {
    const mock = new MockEmailProvider();
    const res = await sendInvitationEmails(
      'https://app.invalid',
      'fr',
      [{ token: 'ref.sig', address: 'a@synthetic.invalid' }],
      mock,
    );
    expect(res).toEqual({ sent: 1, failed: 0 });
    expect(mock.sent[0]?.text).toContain('https://app.invalid/s/ref.sig');
    expect(mock.sent[0]?.subject).toMatch(/questionnaire/);
    const failing = { name: 'x', send: async () => Promise.reject(new Error('down')) };
    expect(
      await sendInvitationEmails(
        'https://app.invalid',
        'en',
        [{ token: 't', address: 'a@synthetic.invalid' }],
        failing,
      ),
    ).toEqual({ sent: 0, failed: 1 });
    expect(buildMessage('remind', 'en', 'a@synthetic.invalid', 'L').subject).toMatch(/Reminder/);
  });
});
