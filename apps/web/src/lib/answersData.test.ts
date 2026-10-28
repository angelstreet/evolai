import { describe, expect, it } from 'vitest';
import {
  AnswersGroupTooSmallError,
  answerValueText,
  answersCsvRows,
  summariseAnswers,
  teamBriefs,
  type AnswerLine,
} from './answersData';
import { rowsToCsv } from './exportData';

/**
 * TASK-AA, TASK-AD2: the answers CSV and views hold nothing below the minimum group, carry no name
 * column and neutralise spreadsheet formulas. The client is a fake that answers by SQL text.
 */
const T = '33333333-3333-4333-8333-333333333333';
const BIG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const fakeClient = (counts: Record<string, number>, answers: Record<string, unknown>[]) =>
  ({
    query: async (sql: string) => {
      if (sql.includes('count(*)')) {
        return {
          rows: Object.entries(counts).map(([engagement_id, n]) => ({
            engagement_id,
            n: String(n),
          })),
        };
      }
      if (sql.includes('FROM answers')) return { rows: answers };
      return { rows: [] };
    },
  }) as never;

const answer = (engagement: string, code: string, value: unknown) => ({
  respondent_pseudonym: 'r-0001abcd',
  engagement_id: engagement,
  team_id: 'team-1',
  question_code: code,
  question_kind: 'short_text',
  prompt: 'What slows you down?',
  options_json: [],
  value_json: value,
  rationale: null,
  answered_at: '2026-10-01T10:00:00.000Z',
});

describe('answers CSV of one mission', () => {
  it('refuses below 5 submissions', async () => {
    const c = fakeClient({ [BIG]: 4 }, [answer(BIG, 'q1', { kind: 'short_text', text: 'x' })]);
    await expect(answersCsvRows(c, T, BIG)).rejects.toBeInstanceOf(AnswersGroupTooSmallError);
  });

  it('has pseudonym, question, value and time, and no name or address column', async () => {
    const c = fakeClient({ [BIG]: 5 }, [
      answer(BIG, 'q1', { kind: 'short_text', text: 'Slow tools' }),
    ]);
    const rows = await answersCsvRows(c, T, BIG);
    expect(rows.columns).toEqual([
      'respondent_pseudonym',
      'question_code',
      'question',
      'answer',
      'comment',
      'answered_at',
    ]);
    expect(rows.columns.join(' ')).not.toMatch(/name|email|address|ip|team/);
    expect(rows.values[0]).toContain('Slow tools');
  });

  it('neutralises a formula typed as an answer', async () => {
    const c = fakeClient({ [BIG]: 5 }, [
      answer(BIG, 'q1', { kind: 'short_text', text: '=HYPERLINK("http://x","y")' }),
    ]);
    const rows = await answersCsvRows(c, T, BIG);
    const csv = rowsToCsv(rows.columns, rows.values);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });
});

const line = (over: Partial<AnswerLine>): AnswerLine => ({
  pseudonym: 'r-1',
  engagementId: BIG,
  teamId: 'a',
  questionCode: 'v1_source_check',
  question: 'Where do you check?',
  kind: 'scenario_choice',
  value: 'Often',
  comment: '',
  answeredAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('summariseAnswers', () => {
  it('counts choices, most picked first, and lists texts with no pseudonym', () => {
    const out = summariseAnswers([
      line({ pseudonym: 'r-1', value: 'Often' }),
      line({ pseudonym: 'r-2', value: 'Rarely' }),
      line({ pseudonym: 'r-3', value: 'Rarely' }),
      line({
        pseudonym: 'r-4',
        questionCode: 'v1_missing_tool',
        kind: 'short_text',
        value: 'A search tool',
      }),
    ]);
    expect(out.choices[0]?.counts).toEqual([
      { label: 'Rarely', n: 2 },
      { label: 'Often', n: 1 },
    ]);
    expect(out.texts[0]?.items).toEqual(['A search tool']);
    expect(JSON.stringify(out)).not.toContain('r-4');
  });
});

describe('teamBriefs', () => {
  const lines = [
    ...['1', '2', '3', '4', '5'].map((p) => line({ pseudonym: p, teamId: 'big' })),
    ...['1', '2', '3', '4', '5'].map((p) =>
      line({
        pseudonym: p,
        teamId: 'big',
        questionCode: 'v1_job_family',
        kind: 'single_choice',
        value: 'Sales',
      }),
    ),
    line({ pseudonym: '6', teamId: 'small', value: 'Rarely' }),
  ];
  const briefs = teamBriefs(
    [
      { id: 'big', name: 'Team A', expected: 10, submitted: 5 },
      { id: 'small', name: 'Team B', expected: 8, submitted: 1 },
    ],
    lines,
  );

  it('shows a team from five answers, with the role question as the role mix', () => {
    const big = briefs[0];
    expect(big?.hidden).toBe(false);
    expect(big?.choices.map((c) => c.code)).toEqual(['v1_source_check']);
    expect(big?.roles?.counts).toEqual([{ label: 'Sales', n: 5 }]);
  });

  it('hides everything but the counts of a team under five', () => {
    const small = briefs[1];
    expect(small).toMatchObject({
      hidden: true,
      submitted: 1,
      expected: 8,
      choices: [],
      roles: null,
    });
  });
});

describe('answerValueText', () => {
  const options = [
    { value: 'a', label: 'Often' },
    { value: 'b', label: 'Rarely' },
  ];
  it('shows the label of a choice, joins several, keeps text and leaves skipped empty', () => {
    expect(answerValueText({ kind: 'single_choice', choice: 'a' }, options)).toBe('Often');
    expect(answerValueText({ kind: 'multi_choice', choices: ['a', 'b'] }, options)).toBe(
      'Often | Rarely',
    );
    expect(answerValueText({ kind: 'short_text', text: 'hello' }, [])).toBe('hello');
    expect(answerValueText({ kind: 'skipped' }, [])).toBe('');
  });
});

// Type-level guard: a line never carries more than these fields (no name, no address).
const _line: Record<keyof AnswerLine, true> = {
  answerId: true,
  pseudonym: true,
  engagementId: true,
  teamId: true,
  questionCode: true,
  question: true,
  kind: true,
  value: true,
  comment: true,
  answeredAt: true,
};
void _line;
