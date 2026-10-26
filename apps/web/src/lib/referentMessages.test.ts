import { describe, expect, it } from 'vitest';
import { prepareMessages } from './referentMessages';

describe('prepareMessages (fr and en)', () => {
  const facts = { closesOn: '2026-11-12', contact: 'Demo Referent', minutes: 6 };

  it('the invitation says what, how long, anonymous, closing date and contact', () => {
    const en = prepareMessages('en', facts).invite.text;
    expect(en).toContain('about 6 minutes');
    expect(en).toContain('anonymous');
    expect(en).toContain('November 12, 2026');
    expect(en).toContain('Demo Referent');
    const fr = prepareMessages('fr', facts).invite.text;
    expect(fr).toContain('environ 6 minutes');
    expect(fr).toContain('anonyme');
    expect(fr).toContain('12 novembre 2026');
    expect(fr).toContain('Demo Referent');
  });

  it('the reminder is generic: "if you have not answered yet", no count, address only when given', () => {
    for (const locale of ['fr', 'en'] as const) {
      const r = prepareMessages(locale, facts).reminder.text;
      expect(r).toMatch(locale === 'en' ? /if you have not answered/ : /si vous n’avez pas/);
      expect(r).not.toMatch(/https?:\/\//);
      expect(r).not.toMatch(/\{|\}/);
      const withAddress = prepareMessages(locale, {
        ...facts,
        address: 'https://example.test/s/demo-sales',
      }).reminder.text;
      expect(withAddress).toContain('\nhttps://example.test/s/demo-sales\n');
    }
  });

  it('leaves out the closing and contact lines when they are not set', () => {
    const { invite, reminder } = prepareMessages('en', { ...facts, closesOn: null, contact: null });
    expect(invite.text).not.toMatch(/before|Contact/);
    expect(reminder.text).not.toMatch(/closes on|Contact/);
  });
});
