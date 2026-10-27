import { describe, expect, it } from 'vitest';
import { formatOwnerMessage, parseSendRequest } from './sendRequest';

const codes = new Set(['v1_source_check', 'v1_repeat_task']);

describe('parseSendRequest', () => {
  it('accepts choices and counts free text without keeping it', () => {
    const r = parseSendRequest(
      {
        email: ' synthetic@synthetic.invalid ',
        locale: 'fr',
        answers: { v1_source_check: 2, v1_repeat_task: 'copy files' },
      },
      codes,
    );
    expect(r).toEqual({
      email: 'synthetic@synthetic.invalid',
      locale: 'fr',
      choices: { v1_source_check: 2 },
      freeTextCount: 1,
    });
    expect(JSON.stringify(formatOwnerMessage(r!))).not.toContain('copy files');
  });
  it('rejects bad emails, unknown codes and odd values', () => {
    expect(parseSendRequest({ email: 'nope', answers: {} }, codes)).toBeNull();
    expect(
      parseSendRequest({ email: 'synthetic@synthetic.invalid', answers: { v9_x: 1 } }, codes),
    ).toBeNull();
    expect(
      parseSendRequest(
        { email: 'synthetic@synthetic.invalid', answers: { v1_source_check: {} } },
        codes,
      ),
    ).toBeNull();
    expect(
      parseSendRequest(
        { email: 'synthetic@synthetic.invalid', answers: { v1_source_check: -1 } },
        codes,
      ),
    ).toBeNull();
    expect(parseSendRequest(null, codes)).toBeNull();
  });
});
