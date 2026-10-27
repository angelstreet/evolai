/**
 * Public /learn pages: what the audit is, in five short pages (TASK-AE, ADR 0050). Plain short words
 * (docs/UI_RULES.md §8). Mirrored by `learn.fr.ts`.
 */
export const learnEn = {
  nav: 'Learn the audit, page by page',
  progress: 'Page {n} of {total}',
  cockpit: 'Back to the cockpit',
  back: 'Back',
  next: 'Next',
  watch: 'Watch',
  minutes: '{n} min',
  freeText: 'Free text, {max} characters',
  tells: 'What it tells us: {why}',
  videoCaption: 'Video: {title} ({n} min)',
  entry: {
    front: 'Learn how the audit works',
    cardTitle: 'Learn the audit',
    cardBody: 'Five short pages: how it runs, the ten questions and what you get.',
    cardCta: 'Start learning',
  },
  why: {
    title: 'Why an AI audit',
    lead: 'Many companies adopt AI and see little change. Three things often go wrong.',
    item1: 'Tools are bought, but nobody uses them in daily work.',
    item2: 'Client data goes into public AI tools, with no clear rules.',
    item3: 'Hours go to repetitive tasks that nobody has measured.',
    closing:
      'EvolAI does it differently. We ask the people who do the work, then come on site with the picture already clear.',
  },
  how: {
    title: 'How it runs',
    lead: 'Three steps: Understand, Adapt, Evolve. As a referent, you should know these facts.',
    item1:
      'The survey takes about {minutes} minutes on a phone. It has {count} questions and you can skip any of them.',
    item2:
      'Answers are anonymous: no name, no email. Names typed in free text are hidden before saving.',
    item3:
      'The referent sees counts only, never who answered. A group needs {min} people to be shown.',
    item4: 'The visit comes after the survey closes. The report follows the visit.',
  },
  questions: {
    title: 'The ten questions',
    lead: 'These are the survey questions, word for word. You answer them from your survey link, not here.',
    cardLabel: 'Question {n}',
    v1_source_check: { why: 'Whether people check AI answers before using them.' },
    v1_data_sharing: { why: 'How client data is handled today, and whether the rules are known.' },
    v1_request_style: { why: 'How well people already know how to ask.' },
    v1_report_flow: { why: 'Whether people map the work before they automate it.' },
    v1_repeat_data: { why: 'Whether AI is the first reflex, or a simple automation.' },
    v1_repeat_time: { why: 'How big the repetitive work is, team by team.' },
    v1_repeat_task: { why: 'The first candidates for an improvement.' },
    v1_missing_tool: { why: 'Friction that is not about AI at all.' },
    v1_assistant_wish: { why: 'What people would accept help with.' },
    v1_job_family: { why: 'Results by area, only for groups of 5 or more.' },
  },
  results: {
    title: 'What you get',
    lead: 'After the visit, you receive a report with four parts.',
    item1: 'A readiness score from 0 to 100. The higher it is, the more established the practices.',
    item2: 'Ranked actions: what to do first, and why.',
    item3: 'A 30/60/90-day plan, with a step for each period.',
    item4: 'The report as a PDF you can share.',
  },
  more: {
    title: 'Learn more',
    lead: 'Short videos on the audit and on using AI well at work.',
    empty: 'No videos yet. The four pages before this one hold everything you need.',
    surveyLine: 'Received a survey link? Open it from the message you got.',
    signIn: 'Sign in (referents)',
  },
};
