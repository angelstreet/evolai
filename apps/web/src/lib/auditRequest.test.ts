import { describe, expect, it } from 'vitest';
import { domainAcceptsMail, parseEmail, type Resolver } from './auditRequest';

const fail = (code: string) => Promise.reject(Object.assign(new Error(code), { code }));

describe('audit request email (TASK-AI L6)', () => {
  it('accepts a well-formed address and refuses the rest', () => {
    expect(parseEmail('  ana@example.test ')).toBe('ana@example.test');
    for (const bad of [
      '',
      'ana',
      'ana@',
      '@example.test',
      'ana@x',
      'a na@example.test',
      'ana@example.t',
      42,
      null,
    ])
      expect(parseEmail(bad)).toBeNull();
  });

  it('needs a domain that takes mail: MX, else an address record', async () => {
    const mx: Resolver = { mx: async () => [{}], a: async () => [] };
    const aOnly: Resolver = { mx: () => fail('ENODATA'), a: async () => ['192.0.2.1'] };
    const none: Resolver = { mx: () => fail('ENOTFOUND'), a: async () => [] };
    const down: Resolver = { mx: () => fail('ETIMEOUT'), a: async () => [] };
    expect(await domainAcceptsMail('a@example.test', mx)).toBe('ok');
    expect(await domainAcceptsMail('a@example.test', aOnly)).toBe('ok');
    expect(await domainAcceptsMail('a@example.test', none)).toBe('no_mail');
    expect(await domainAcceptsMail('a@example.test', down)).toBe('unknown');
    expect(await domainAcceptsMail('a@synthetic.invalid', mx)).toBe('no_mail');
  });
});
