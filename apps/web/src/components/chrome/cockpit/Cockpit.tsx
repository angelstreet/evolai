'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Logo } from '@/components/Logo';
import { useI18n } from '@/components/I18nProvider';
import {
  AccountMenu,
  LanguageToggle,
  ThemeToggle,
  type Identity,
} from '@/components/chrome/HeaderControls';
import {
  LESSON_KEYS,
  TOTAL_STEPS,
  answeredCount,
  stepList,
  stepsDone,
  type CockpitAnswers,
  type Progress,
} from '@/lib/cockpitModel';
import {
  ARROW_LEFT,
  ARROW_RIGHT,
  CHECK,
  CHEVRON_RIGHT,
  CIRCLE,
  DOT,
  EDIT,
  LOCK,
  MENU_ICONS,
  PLAY,
  SHIELD,
  SIDE_ART,
  TILE_ICONS,
  VIDEO_ART,
} from './icons';
import PrimaryButton from './PrimaryButton';
import SendSheet from './SendSheet';

export interface CockpitQuestion {
  readonly code: string;
  readonly kind: 'choice' | 'text';
  readonly prompt: string;
  readonly helper: string | null;
  readonly options: readonly string[];
}
export interface CockpitVideo {
  readonly youtubeId: string | null;
  readonly title: string;
}
export type Viewer =
  | { readonly kind: 'anon' }
  | { readonly kind: 'referent'; readonly name: string }
  | { readonly kind: 'staff'; readonly name: string };

interface Props {
  readonly questions: readonly CockpitQuestion[];
  readonly freeTextHint: string;
  readonly freeTextMax: number;
  readonly videos: readonly CockpitVideo[];
  readonly viewer: Viewer;
  readonly identity: Identity | null;
}

type Section = 'home' | 'learn' | 'videos' | 'survey' | 'report';
const SECTIONS: readonly Section[] = ['home', 'learn', 'videos', 'survey', 'report'];
const COUNTS: Partial<Record<Section, number>> = { learn: 5, videos: 10, survey: 10 };
const TILE_SETS = [
  { icon: 'eye', tone: 'amber' },
  { icon: 'target', tone: 'blue' },
  { icon: 'route', tone: 'teal' },
] as const;

const STORE = 'evolai-cockpit-v1';

interface Stored {
  answers: Record<string, number | string>;
  seen: number[];
  qi: number;
  sent: boolean;
}

export default function Cockpit({
  questions,
  freeTextHint,
  freeTextMax,
  videos,
  viewer,
  identity,
}: Props) {
  const { t, locale } = useI18n();
  const tk = useCallback(
    (key: string, vars?: Record<string, string | number>) => t(key as never, vars),
    [t],
  );
  const signed = viewer.kind !== 'anon';
  const total = questions.length;

  const [section, setSection] = useState<Section>('home');
  const [lesson, setLesson] = useState(0);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<CockpitAnswers>({});
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());
  const [sent, setSent] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [splash, setSplash] = useState<'on' | 'out' | 'off'>('on');
  const [today, setToday] = useState('');
  const [loaded, setLoaded] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Browser-only state: answers and progress never leave the browser until the send step.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Stored>;
        if (s.answers && typeof s.answers === 'object') setAnswers(s.answers);
        if (Array.isArray(s.seen)) setSeen(new Set(s.seen.filter((n) => Number.isInteger(n))));
        if (typeof s.qi === 'number') setQi(Math.max(0, Math.min(total, s.qi)));
        if (s.sent === true) setSent(true);
      }
    } catch {
      /* private mode: the cockpit still works for this visit */
    }
    setLoaded(true);
  }, [total]);
  useEffect(() => {
    if (!loaded) return;
    try {
      const s: Stored = { answers: { ...answers }, seen: [...seen], qi, sent };
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [loaded, answers, seen, qi, sent]);

  // Splash: once per load, 0.8 s, skipped under reduced motion (CSS hides it too).
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSplash('off');
      return;
    }
    const a = setTimeout(() => setSplash('out'), 800);
    const b = setTimeout(() => setSplash('off'), 1020);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    );
  }, [locale]);

  const progress: Progress = useMemo(
    () => ({ lessonsSeen: seen, questionIndex: qi, questionCount: total, sent }),
    [seen, qi, total, sent],
  );
  const done = stepsDone(progress);
  const answered = answeredCount(answers);

  const markSeen = (i: number) => setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
  const scrollToMain = () => {
    const el = mainRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
  };
  const open = (s: Section) => {
    setSection(s);
    scrollToMain();
  };
  // A lesson counts as done when the person moves on from it, never on opening it or from the path.
  const pageLesson = (d: number) => {
    if (d > 0) markSeen(lesson);
    setLesson(Math.max(0, Math.min(LESSON_KEYS.length - 1, lesson + d)));
  };
  const finishLessons = () => {
    markSeen(lesson);
    open('survey');
  };

  const send = async (email: string) => {
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, locale, answers }),
      });
      if (res.ok) {
        setSent(true);
        return null;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return body?.error === 'invalid'
        ? 'invalid'
        : body?.error === 'busy'
          ? 'busy'
          : 'unavailable';
    } catch {
      return 'unavailable';
    }
  };

  const hasAnswer = (code: string) => {
    const v = answers[code];
    return v !== undefined && v !== '';
  };

  /* ---------- content cards ---------- */
  const tile = (icon: keyof typeof TILE_ICONS, tone: string, title: string, line: string) => (
    <div className="ck-point" key={title}>
      <span className={`ck-tile ${tone}`}>{TILE_ICONS[icon]}</span>
      <b>{title}</b>
      <span>{line}</span>
    </div>
  );

  const homeCard = () => (
    <>
      <h1>{t('cockpit.home.title')}</h1>
      <p className="ck-lede">{t('cockpit.home.lede')}</p>
      <div className="ck-points">
        {(['understand', 'adapt', 'evolve'] as const).map((k, i) =>
          tile(
            TILE_SETS[i]?.icon ?? 'eye',
            TILE_SETS[i]?.tone ?? 'amber',
            tk(`cockpit.home.${k}.title`),
            tk(`cockpit.home.${k}.line`),
          ),
        )}
      </div>
      {videoSlot(0, 'home-video')}
      <div className="ck-foot-row">
        <span />
        <Button variant="outlined" onClick={() => open('learn')} sx={{ minHeight: 44 }}>
          {t('cockpit.home.start')}
          {ARROW_RIGHT}
        </Button>
      </div>
    </>
  );

  const videoSlot = (i: number, key?: string) => {
    const v = videos[i];
    const title = v?.title || tk(`cockpit.videos.v${i + 1}`);
    return (
      <div className="ck-video" key={key ?? i} data-testid="ck-video">
        {v?.youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
            title={title}
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <>
            {VIDEO_ART}
            <span className="ck-play">
              <i>{PLAY}</i>
              <span>
                {t('cockpit.videos.video', { n: i + 1 })}{' '}
                <span className="ck-soft-text">{t('cockpit.videos.soon')}</span>
              </span>
            </span>
          </>
        )}
      </div>
    );
  };

  const learnCard = () => {
    const key = LESSON_KEYS[lesson] ?? 'why';
    return (
      <>
        <h1>{tk(`cockpit.learn.${key}.title`)}</h1>
        <p className="ck-lede">{tk(`cockpit.learn.${key}.lede`)}</p>
        <div className="ck-points">
          {([1, 2, 3] as const).map((n) =>
            tile(
              TILE_SETS[n - 1]?.icon ?? 'eye',
              TILE_SETS[n - 1]?.tone ?? 'amber',
              tk(`cockpit.learn.${key}.p${n}.title`),
              tk(`cockpit.learn.${key}.p${n}.line`),
            ),
          )}
        </div>
        {videoSlot(lesson * 2, 'lesson-video')}
        <div className="ck-foot-row">
          <Button
            variant="text"
            color="inherit"
            disabled={lesson === 0}
            onClick={() => pageLesson(-1)}
            sx={{ minHeight: 44 }}
          >
            {ARROW_LEFT}
            {t('cockpit.learn.previous')}
          </Button>
          {lesson < LESSON_KEYS.length - 1 ? (
            <Button variant="outlined" onClick={() => pageLesson(1)} sx={{ minHeight: 44 }}>
              {t('cockpit.learn.next')}
              {ARROW_RIGHT}
            </Button>
          ) : (
            <Button variant="outlined" onClick={finishLessons} sx={{ minHeight: 44 }}>
              {t('cockpit.learn.toSurvey')}
              {ARROW_RIGHT}
            </Button>
          )}
        </div>
      </>
    );
  };

  const videosCard = () => (
    <>
      <h1>{t('cockpit.videos.title')}</h1>
      <p className="ck-lede">{t('cockpit.videos.lede')}</p>
      <div className="ck-vgrid">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i}>
            {videoSlot(i)}
            <p className="ck-vtitle">{videos[i]?.title || tk(`cockpit.videos.v${i + 1}`)}</p>
          </div>
        ))}
      </div>
    </>
  );

  const surveyCard = () => (
    <>
      <h1>{t('cockpit.survey.title')}</h1>
      <p className="ck-lede">{t('cockpit.survey.lede')}</p>
      <ol className="ck-qlist">
        {questions.map((q, i) => (
          <li key={q.code}>
            <button
              type="button"
              onClick={() => setQi(i)}
              aria-current={i === qi && qi < total}
              data-testid="ck-question-row"
            >
              <span className="ck-qn">{i + 1}</span>
              <span className="ck-qt">{q.prompt}</span>
              <span className={`ck-status${hasAnswer(q.code) ? ' done' : ''}`}>
                {hasAnswer(q.code) ? CHECK : CIRCLE}
                {hasAnswer(q.code) ? t('cockpit.survey.answered') : t('cockpit.survey.todo')}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );

  const dial = (score: number) => {
    const r = 52;
    const c = 2 * Math.PI * r;
    return (
      <svg
        viewBox="0 0 132 132"
        width={132}
        height={132}
        role="img"
        aria-label={t('cockpit.report.dialAria', { score })}
        style={{ flex: 'none' }}
      >
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--color-border)" strokeWidth="12" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          transform="rotate(-90 66 66)"
        />
        <text
          x="66"
          y="66"
          textAnchor="middle"
          fontSize="32"
          fontWeight="600"
          fill="var(--color-fg)"
        >
          {score}
        </text>
        <text x="66" y="86" textAnchor="middle" fontSize="11" fill="var(--color-muted)">
          / 100
        </text>
      </svg>
    );
  };
  const reportCard = () => (
    <>
      <h1>{t('cockpit.report.client')}</h1>
      <div className="ck-score">
        {dial(62)}
        <div>
          <b>{t('cockpit.report.score')}</b>
          <p className="ck-lede">{t('cockpit.report.summary')}</p>
        </div>
      </div>
      <h2 className="ck-h2">{t('cockpit.report.actions')}</h2>
      <div className="ck-acts">
        {(['30', '60', '90'] as const).map((d) => (
          <div className="ck-act" key={d}>
            <span className="d">{t('cockpit.report.days', { n: d })}</span>
            <b>{tk(`cockpit.report.a${d}`)}</b>
            <span className="ck-muted">{tk(`cockpit.report.o${d}`)}</span>
          </div>
        ))}
      </div>
    </>
  );

  const card = () => {
    switch (section) {
      case 'learn':
        return learnCard();
      case 'videos':
        return videosCard();
      case 'survey':
        return surveyCard();
      case 'report':
        return reportCard();
      default:
        return homeCard();
    }
  };

  /* ---------- Try it: shares answers and position with the survey ---------- */
  const tryIt = () => {
    const finished = qi >= total;
    const q = questions[Math.min(qi, total - 1)];
    const v = q ? answers[q.code] : undefined;
    const ready = q
      ? q.kind === 'text'
        ? typeof v === 'string' && v.trim() !== ''
        : v !== undefined
      : false;
    const setAnswer = (val: number | string) => q && setAnswers((a) => ({ ...a, [q.code]: val }));
    const skip = () => {
      if (!q) return;
      setAnswers((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== q.code)));
      setQi((n) => Math.min(n + 1, total));
    };
    return (
      <section className="ck-card ck-try" aria-labelledby="ck-try-h">
        <div className="ck-try-head">
          <h2 id="ck-try-h">
            {EDIT}
            <span>{t('cockpit.tryIt.title')}</span>
          </h2>
          <span className="ck-count" data-testid="ck-try-count">
            {t('cockpit.tryIt.count', { n: Math.min(qi + 1, total) })}
          </span>
        </div>
        <div className="ck-try-body">
          {/* each segment jumps to its question: one before the current, answered, or right after an answered one */}
          <div className="ck-qbar">
            {questions.map((c, i) => {
              const prev = questions[i - 1];
              const reachable = i <= qi || hasAnswer(c.code) || (!!prev && hasAnswer(prev.code));
              return (
                <button
                  key={c.code}
                  type="button"
                  className={i <= qi ? 'on' : undefined}
                  disabled={!reachable}
                  aria-current={i === qi ? 'step' : undefined}
                  aria-label={t('cockpit.tryIt.goTo', { n: i + 1 })}
                  onClick={() => setQi(i)}
                  data-testid="ck-qbar-step"
                >
                  <i />
                </button>
              );
            })}
          </div>
          {finished || !q ? (
            <>
              <p className="ck-q" data-testid="ck-try-done">
                {t('cockpit.tryIt.complete', { n: answered })}
              </p>
              <p className="ck-muted ck-small">{t('cockpit.tryIt.stays')}</p>
              <PrimaryButton
                fullWidth
                onClick={() => setSheet(true)}
                sx={{ mt: 3 }}
                data-testid="ck-send"
              >
                {t('cockpit.survey.send')}
              </PrimaryButton>
              <div className="ck-try-nav">
                <Button
                  variant="text"
                  color="inherit"
                  onClick={() => setQi(0)}
                  sx={{ minHeight: 44 }}
                >
                  {t('cockpit.tryIt.review')}
                </Button>
              </div>
            </>
          ) : (
            <div key={q.code}>
              <p className="ck-q" data-testid="ck-try-question">
                {q.prompt}
              </p>
              {q.helper && <p className="ck-muted ck-small">{q.helper}</p>}
              {q.kind === 'choice' ? (
                <div className="ck-opts" role="radiogroup" aria-label={q.prompt}>
                  {q.options.map((o, j) => (
                    <button
                      key={o}
                      type="button"
                      className="ck-opt"
                      role="radio"
                      aria-checked={v === j}
                      onClick={() => setAnswer(j)}
                      data-testid="ck-option"
                    >
                      <span className="box">{CHECK}</span>
                      <span>{o}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <TextField
                    multiline
                    minRows={3}
                    fullWidth
                    placeholder={t('cockpit.tryIt.placeholder')}
                    value={typeof v === 'string' ? v : ''}
                    onChange={(e) => setAnswer(e.target.value)}
                    slotProps={{ htmlInput: { maxLength: freeTextMax, 'aria-label': q.prompt } }}
                    sx={{ mt: 3 }}
                  />
                  <p className="ck-muted ck-small ck-mt">{freeTextHint}</p>
                </>
              )}
              <PrimaryButton
                fullWidth
                disabled={!ready}
                onClick={() => setQi((n) => Math.min(n + 1, total))}
                sx={{ mt: 3 }}
                data-testid="ck-next"
              >
                {qi === total - 1 ? t('cockpit.tryIt.finish') : t('cockpit.tryIt.next')}
                {ARROW_RIGHT}
              </PrimaryButton>
              <p className="ck-hint" data-testid="ck-hint">
                {SHIELD}
                <span>{ready ? t('cockpit.tryIt.kept') : t('cockpit.tryIt.pick')}</span>
              </p>
              {/* choice questions offer "I don't know"; only free text can be left empty */}
              {(qi > 0 || q.kind === 'text') && (
                <div className="ck-try-nav">
                  {qi > 0 && (
                    <Button
                      variant="text"
                      color="inherit"
                      onClick={() => setQi((n) => Math.max(0, n - 1))}
                      sx={{ minHeight: 44 }}
                      data-testid="ck-prev"
                    >
                      {ARROW_LEFT}
                      {t('cockpit.back')}
                    </Button>
                  )}
                  {q.kind === 'text' && (
                    <Button
                      variant="text"
                      color="inherit"
                      onClick={skip}
                      sx={{ minHeight: 44, ml: 'auto' }}
                    >
                      {t('cockpit.skip')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  /* ---------- Your path ---------- */
  const stepName = (i: number) => t(`cockpit.path.s${i + 1}` as 'cockpit.path.s1');
  const path = () => {
    const steps = stepList(progress);
    const nowIndex = steps.findIndex((s) => !s.done);
    return (
      <section className="ck-card ck-path" aria-labelledby="ck-path-h">
        <h2 id="ck-path-h">
          <span>{t('cockpit.path.title')}</span>
          <span className="ck-count" data-testid="ck-path-count">
            {t('cockpit.path.count', { n: done })}
          </span>
        </h2>
        <div className="ck-pbar" aria-hidden="true">
          <i style={{ width: `${(done / TOTAL_STEPS) * 100}%` }} />
        </div>
        <ol>
          {steps.map((s, i) => {
            const state = s.done ? 'done' : i === nowIndex ? 'now' : 'todo';
            const lastLocked = i === steps.length - 1 && !s.done && !signed;
            const word = s.done
              ? t('cockpit.path.done')
              : lastLocked
                ? t('cockpit.path.signIn')
                : state === 'now'
                  ? t('cockpit.path.now')
                  : t('cockpit.path.todo');
            return (
              // read-only: the status comes from the person's progress, not from a click
              <li key={i} className={state} data-testid="ck-path-step">
                <span className="ck-step-name">{stepName(i)}</span>
                <span className="ck-status">
                  {s.done ? CHECK : lastLocked ? LOCK : state === 'now' ? DOT : CIRCLE}
                  <span className="ck-word">{word}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    );
  };

  /* ---------- chrome ---------- */
  const crumb =
    section === 'learn'
      ? t('cockpit.header.lesson', { n: lesson + 1 })
      : section === 'survey'
        ? qi >= total
          ? t('cockpit.header.done')
          : t('cockpit.header.question', { n: qi + 1 })
        : null;

  return (
    <div className="ck" data-testid="cockpit">
      {splash !== 'off' && (
        <div
          className={`ck-splash${splash === 'out' ? ' out' : ''}`}
          aria-hidden="true"
          data-testid="ck-splash"
        >
          <div className="in">
            <Logo iconOnly size="hero" />
            <b>{t('common.brand')}</b>
            <div className="ck-bar">
              <i />
            </div>
          </div>
        </div>
      )}
      <aside className="ck-side">
        <nav className="ck-menu" aria-label={t('cockpit.menu.aria')}>
          {SECTIONS.map((k) => (
            <button
              key={k}
              type="button"
              data-k={k}
              aria-current={k === section ? 'page' : undefined}
              onClick={() => open(k)}
            >
              {MENU_ICONS[k]}
              <span className="ck-label">{tk(`cockpit.menu.${k}`)}</span>
              {COUNTS[k] ? <span className="ck-nav-count">{COUNTS[k]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="ck-spacer" />
        <div className="ck-illus">
          {SIDE_ART}
          <p>{t('cockpit.menu.note')}</p>
        </div>
      </aside>
      <div className="ck-content">
        <header className="ck-top">
          <div className="ck-brand">
            <Logo size="menu" />
          </div>
          <div className="ck-crumb" data-testid="ck-crumb">
            <span>{tk(`cockpit.menu.${section}`)}</span>
            {crumb && (
              <>
                {CHEVRON_RIGHT}
                <b>{crumb}</b>
              </>
            )}
          </div>
          <div className="ck-utils">
            <span className="ck-date" suppressHydrationWarning>
              {today}
            </span>
            <LanguageToggle />
            <ThemeToggle />
            {identity && <AccountMenu identity={identity} />}
          </div>
        </header>
        <main id="main" tabIndex={-1} className="ck-grid" ref={mainRef}>
          <article className="ck-card ck-lesson" data-testid="ck-main">
            {card()}
          </article>
          <div className="ck-stack">
            {tryIt()}
            {path()}
          </div>
        </main>
        <footer className="ck-footer">
          <span>{t('cockpit.footer.line')}</span>
          <span className="ck-links">
            <Link href="/privacy">{t('cockpit.footer.privacy')}</Link>
            <a href="https://github.com/angelstreet/evolai" rel="noopener noreferrer">
              {t('cockpit.footer.source')}
            </a>
            <Link href="/login" data-testid="front-sign-in">
              {t('cockpit.footer.auditor')}
            </Link>
          </span>
        </footer>
      </div>
      <SendSheet open={sheet} answered={answered} onClose={() => setSheet(false)} onSend={send} />
    </div>
  );
}
