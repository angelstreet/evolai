'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import Button from '@mui/material/Button';
import { Logo } from '@/components/Logo';
import { useI18n } from '@/components/I18nProvider';
import { LanguageToggle, ThemeToggle } from '@/components/chrome/HeaderControls';
import { setLocaleAction } from '@/lib/localeAction';
import {
  LESSON_KEYS,
  STAGE_KEYS,
  TOTAL_STEPS,
  answeredCount,
  dayPart,
  nextStep,
  stepList,
  stepsDone,
  wrapStage,
  type CockpitAnswers,
  type Progress,
  type Step,
} from '@/lib/cockpitModel';
import { ARROW_LEFT, ARROW_RIGHT, CHECK, PLAY, RAIL_ICONS, STEP_GLYPHS } from './icons';
import PrimaryButton from './PrimaryButton';
import SendSheet from './SendSheet';

export interface CockpitQuestion {
  readonly code: string;
  readonly kind: 'choice' | 'text';
  readonly prompt: string;
  readonly helper: string | null;
  readonly options: readonly string[];
  readonly why: string;
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
}

type View = 'stage' | 'progress';
type Tab = 'ov' | 'qs' | 'rp' | 'rs';
type RailKey = 'home' | 'journey' | 'learn' | 'questions' | 'survey' | 'materials' | 'progress';

const STORE = 'evolai-cockpit-v1';
const RAIL: readonly RailKey[] = [
  'home',
  'journey',
  'learn',
  'questions',
  'survey',
  'materials',
  'progress',
];

interface Stored {
  answers: Record<string, number | string>;
  seen: number[];
  qi: number;
  sent: boolean;
}

export default function Cockpit({ questions, freeTextHint, freeTextMax, videos, viewer }: Props) {
  const { t, locale } = useI18n();
  const tk = useCallback(
    (key: string, vars?: Record<string, string | number>) => t(key as never, vars),
    [t],
  );
  const signed = viewer.kind !== 'anon';
  const total = questions.length;

  const [si, setSi] = useState(0);
  const [view, setView] = useState<View>('stage');
  const [tab, setTab] = useState<Tab>('ov');
  const [lesson, setLesson] = useState(0);
  const [step, setStep] = useState(0);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<CockpitAnswers>({});
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());
  const [sent, setSent] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [splash, setSplash] = useState<'on' | 'out' | 'off'>('on');
  const [today, setToday] = useState('');
  const [hour, setHour] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [, startTransition] = useTransition();
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
    const d = new Date();
    setHour(d.getHours());
    setToday(
      d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
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
  const next = nextStep(progress);
  const stageKey = STAGE_KEYS[si] ?? 'journey';
  const answered = answeredCount(answers);

  // 150 ms fade on a stage change; none on the first paint (nothing moves on its own).
  const fadeKey = `${view}-${stageKey}-${lesson}`;
  const lastKey = useRef(fadeKey);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    if (lastKey.current !== fadeKey) setFade(true);
    lastKey.current = fadeKey;
  }, [fadeKey]);

  const markSeen = (i: number) => setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
  const setStage = (i: number) => {
    const n = wrapStage(i);
    setSi(n);
    setView('stage');
    if (STAGE_KEYS[n] === 'learn') markSeen(lesson);
  };
  const scrollToStage = () => {
    const el = mainRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
  };
  const goStep = (s: Step) => {
    if (s.target.kind === 'send') return setSheet(true);
    if (s.target.kind === 'lesson') {
      setLesson(s.target.index);
      markSeen(s.target.index);
      setSi(1);
    } else setSi(2);
    setView('stage');
    scrollToStage();
  };
  const goRail = (k: RailKey) => {
    if (k === 'progress') return setView('progress');
    if (k === 'questions') {
      setView('stage');
      setTab('qs');
      document.getElementById('ck-side')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    setStage(k === 'home' || k === 'journey' ? 0 : STAGE_KEYS.indexOf(k as 'learn'));
    scrollToStage();
  };
  const pageLesson = (d: number) => {
    const n = Math.max(0, Math.min(LESSON_KEYS.length - 1, lesson + d));
    setLesson(n);
    markSeen(n);
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

  const lessonLabel = (i: number) => tk(`cockpit.lessons.${LESSON_KEYS[i] ?? 'why'}.title`);
  const stepTitle = (s: Step) =>
    s.target.kind === 'lesson'
      ? lessonLabel(s.target.index)
      : s.target.kind === 'survey'
        ? t('cockpit.strip.surveyStep')
        : t('cockpit.survey.send');
  const tick = (c: boolean) => (
    <span className={`ck-tick${signed && c ? ' on' : ''}`}>{CHECK}</span>
  );

  /* ---------- views ---------- */
  const qCard = (q: CockpitQuestion, i: number, why = true): ReactNode => (
    <div className="ck-card ck-qc" key={q.code} data-testid="ck-question-card">
      <span className="ck-mono">
        {t('cockpit.questions.label', { n: i + 1 })}
        {q.kind === 'text' ? ` · ${t('cockpit.questions.freeText')}` : ''}
      </span>
      <p style={{ fontWeight: 600, margin: '6px 0' }}>{q.prompt}</p>
      {q.options.length > 0 && (
        <ul className="ck-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-sm)' }}>
          {q.options.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      )}
      {why && q.why && (
        <p className="ck-why">
          <span className="ck-mono" style={{ display: 'block' }}>
            {t('cockpit.questions.why')}
          </span>
          {q.why}
        </p>
      )}
    </div>
  );
  const videoCard = (i: number) => {
    const v = videos[i];
    const title = v?.title || tk(`cockpit.materials.v${i + 1}`);
    return (
      <div className="ck-card ck-vid" key={i} data-testid="ck-video">
        <div className="frame">
          {v?.youtubeId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
              title={title}
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            PLAY
          )}
        </div>
        <span className="ck-mono">
          {t('cockpit.materials.video', { n: i + 1 })}
          {v?.youtubeId ? '' : ` · ${t('cockpit.materials.coming')}`}
        </span>
        <b>{title}</b>
      </div>
    );
  };

  const lessonView = () => {
    const key = LESSON_KEYS[lesson] ?? 'why';
    const bullets =
      key === 'why' || key === 'how' ? [1, 2, 3, 4] : key === 'results' ? [1, 2, 3] : [];
    return (
      <>
        <span className="ck-mono">{t('cockpit.lessons.label', { n: lesson + 1 })}</span>
        <h1 style={{ margin: '6px 0 10px', fontSize: 'var(--text-xl)' }}>{lessonLabel(lesson)}</h1>
        <p style={{ fontSize: 'var(--text-base)' }}>{tk(`cockpit.lessons.${key}.b0`)}</p>
        {bullets.length > 0 && (
          <ul className="ck-lst">
            {bullets.map((n) => (
              <li key={n}>{tk(`cockpit.lessons.${key}.b${n}`)}</li>
            ))}
          </ul>
        )}
        {key === 'questions' && (
          <div className="ck-qgrid">{questions.map((q, i) => qCard(q, i))}</div>
        )}
        {key === 'videos' && (
          <div className="ck-vgrid">{Array.from({ length: 10 }, (_, i) => videoCard(i))}</div>
        )}
        <div className="ck-pg">
          <Button
            variant="outlined"
            disabled={lesson === 0}
            onClick={() => pageLesson(-1)}
            sx={{ minHeight: 44 }}
          >
            {t('cockpit.back')}
          </Button>
          <span className="ck-mono">{lesson + 1} / 5</span>
          {lesson < LESSON_KEYS.length - 1 ? (
            <PrimaryButton onClick={() => pageLesson(1)}>{t('cockpit.next')}</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => setStage(2)}>
              {t('cockpit.lessons.toSurvey')}
            </PrimaryButton>
          )}
        </div>
      </>
    );
  };

  const surveyView = () => {
    if (qi >= total) {
      return (
        <div className="ck-sv">
          <div className="ck-sv-top">
            <span className="ck-mono">{t('cockpit.survey.complete')}</span>
            <span className="ck-mono">
              {answered} / {total}
            </span>
          </div>
          <div className="ck-bar">
            <i style={{ width: '100%' }} />
          </div>
          <h1 className="ck-sv-q">{t('cockpit.survey.youAnswered', { n: answered })}</h1>
          <p className="ck-muted">{t('cockpit.survey.stays')}</p>
          <div className="ck-sv-nav">
            <Button variant="outlined" onClick={() => setQi(0)} sx={{ minHeight: 44 }}>
              {t('cockpit.survey.review')}
            </Button>
            <PrimaryButton onClick={() => setSheet(true)}>{t('cockpit.survey.send')}</PrimaryButton>
          </div>
        </div>
      );
    }
    const q = questions[qi];
    if (!q) return null;
    const v = answers[q.code];
    const setAnswer = (val: number | string) => setAnswers((a) => ({ ...a, [q.code]: val }));
    const forward = (skip: boolean) => {
      if (skip)
        setAnswers((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== q.code)));
      setQi((n) => Math.min(n + 1, total));
    };
    return (
      <div className="ck-sv" key={q.code}>
        <div className="ck-sv-top">
          <span className="ck-mono">{t('cockpit.survey.progress', { n: qi + 1 })}</span>
          <span className="ck-mono">{t('cockpit.survey.about')}</span>
        </div>
        <div className="ck-bar">
          <i style={{ width: `${(qi / total) * 100}%` }} />
        </div>
        <h1 className="ck-sv-q">{q.prompt}</h1>
        {q.helper && (
          <p className="ck-muted" style={{ fontSize: 'var(--text-sm)' }}>
            {q.helper}
          </p>
        )}
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
                <span className="dot" />
                <span>{o}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <textarea
              maxLength={freeTextMax}
              aria-label={q.prompt}
              placeholder={t('cockpit.survey.placeholder')}
              value={typeof v === 'string' ? v : ''}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <p className="ck-muted" style={{ fontSize: 'var(--text-xs)', marginTop: 6 }}>
              {freeTextHint}
            </p>
          </>
        )}
        <div className="ck-sv-nav">
          <Button
            variant="text"
            disabled={qi === 0}
            onClick={() => setQi((n) => Math.max(0, n - 1))}
            sx={{ minHeight: 44, visibility: qi === 0 ? 'hidden' : 'visible' }}
          >
            {t('cockpit.back')}
          </Button>
          <div className="r">
            <Button variant="text" onClick={() => forward(true)} sx={{ minHeight: 44 }}>
              {t('cockpit.skip')}
            </Button>
            <PrimaryButton onClick={() => forward(false)} data-testid="ck-next">
              {qi === total - 1 ? t('cockpit.finish') : t('cockpit.next')}
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  };

  const dial = (score: number, size: number) => {
    const r = 52;
    const c = 2 * Math.PI * r;
    return (
      <svg
        viewBox="0 0 132 132"
        width={size}
        height={size}
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
  const reportView = () => (
    <>
      <span className="ck-mono">{t('cockpit.report.label')}</span>
      <h1 style={{ margin: '6px 0 14px', fontSize: 'var(--text-xl)' }}>
        {t('cockpit.report.client')} <span className="ck-mono">({t('cockpit.report.sample')})</span>
      </h1>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {dial(62, 132)}
        <div style={{ flex: 1, minWidth: 200 }}>
          <span className="ck-mono">{t('cockpit.report.score')}</span>
          <p style={{ marginTop: 4 }}>{t('cockpit.report.summary')}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
        <span className="ck-mono">{t('cockpit.report.actions')}</span>
        {(['30', '60', '90'] as const).map((d) => (
          <div className="ck-card ck-act" key={d}>
            <span className="d">{t('cockpit.report.days', { n: d })}</span>
            <b style={{ fontSize: 'var(--text-sm)' }}>{tk(`cockpit.report.a${d}`)}</b>
            <span className="ck-muted" style={{ fontSize: 'var(--text-sm)' }}>
              {tk(`cockpit.report.o${d}`)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
  const journeyView = () => {
    const keys = ['s1', 's2', 's3'] as const;
    return (
      <>
        <h1 style={{ fontSize: 'var(--text-xl)' }}>{t('cockpit.journey.title')}</h1>
        <p className="ck-muted" style={{ marginTop: 6 }}>
          {t('cockpit.journey.lede')}
        </p>
        <div className="ck-jr">
          {keys.map((k, i) => (
            <button
              key={k}
              type="button"
              className="ck-node"
              aria-pressed={i === step}
              onClick={() => setStep(i)}
              data-testid="ck-journey-node"
            >
              <span className="ck-ring">{STEP_GLYPHS[i]}</span>
              <b>
                {i + 1} · {tk(`cockpit.journey.${k}.name`)}
              </b>
              <span className="co">{tk(`cockpit.journey.${k}.summary`)}</span>
            </button>
          ))}
        </div>
        <div className="ck-callout">
          <div>
            <span className="ck-mono">{t('cockpit.journey.step', { n: step + 1 })}</span>
            <p style={{ marginTop: 4, fontWeight: 500 }}>
              {tk(`cockpit.journey.s${step + 1}.summary`)}
            </p>
          </div>
          <PrimaryButton onClick={() => setStage(2)}>{t('cockpit.journey.cta')}</PrimaryButton>
        </div>
      </>
    );
  };
  const materialsView = () => (
    <>
      <span className="ck-mono">{t('cockpit.materials.label')}</span>
      <h1 style={{ margin: '6px 0 4px', fontSize: 'var(--text-xl)' }}>
        {t('cockpit.materials.title')}
      </h1>
      <p className="ck-muted">{t('cockpit.materials.note')}</p>
      <div className="ck-vgrid">{Array.from({ length: 10 }, (_, i) => videoCard(i))}</div>
    </>
  );
  const progressView = () => (
    <>
      <span className="ck-mono">{t('cockpit.progress.title')}</span>
      <h1 style={{ margin: '6px 0 4px', fontSize: 'var(--text-xl)' }}>
        {t('cockpit.progress.done', { n: done })}
      </h1>
      <div className="ck-bar" style={{ marginTop: 10 }}>
        <i style={{ width: `${(done / TOTAL_STEPS) * 100}%` }} />
      </div>
      <ul className="ck-steps-l">
        {stepList(progress).map((s, i) => (
          <li key={i}>
            {tick(s.done)}
            <span style={{ flex: 1 }}>
              {i + 1} · {stepTitle(s)}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        {next ? (
          <PrimaryButton onClick={() => goStep(next)}>{stepTitle(next)}</PrimaryButton>
        ) : (
          <p className="ck-muted">{t('cockpit.progress.allDone')}</p>
        )}
      </div>
    </>
  );

  const stageBody = () => {
    if (view === 'progress') return progressView();
    switch (stageKey) {
      case 'journey':
        return journeyView();
      case 'learn':
        return lessonView();
      case 'survey':
        return surveyView();
      case 'report':
        return reportView();
      default:
        return materialsView();
    }
  };

  const sideBody = () => {
    const sk = (['s1', 's2', 's3'] as const)[step] ?? 's1';
    if (tab === 'ov') {
      return (
        <>
          <span className="ck-mono">
            {t('cockpit.journey.step', { n: step + 1 })} · {tk(`cockpit.journey.${sk}.name`)}
          </span>
          <ul className="ck-mini">
            {[1, 2, 3].map((n) => (
              <li key={n}>{tk(`cockpit.journey.${sk}.t${n}`)}</li>
            ))}
          </ul>
          <p className="ck-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 12 }}>
            {t('cockpit.journey.openNote')}
          </p>
        </>
      );
    }
    if (tab === 'qs') {
      return (
        <>
          <ul className="ck-mini">
            {questions.map((q) => (
              <li key={q.code} style={{ display: 'flex', gap: 8 }}>
                <span
                  className={`ck-tick${answers[q.code] !== undefined && answers[q.code] !== '' ? ' on' : ''}`}
                >
                  {CHECK}
                </span>
                <span>{q.prompt}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setStage(2)}
            sx={{ mt: 2, minHeight: 44 }}
          >
            {t('cockpit.questions.answerThem')}
          </Button>
        </>
      );
    }
    if (tab === 'rp') {
      return (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {dial(62, 84)}
            <p style={{ fontSize: 'var(--text-sm)' }}>
              {t('cockpit.report.sidebar')}{' '}
              <span className="ck-mono">{t('cockpit.report.sample')}</span>
            </p>
          </div>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setStage(3)}
            sx={{ mt: 2, minHeight: 44 }}
          >
            {t('cockpit.report.openSample')}
          </Button>
        </>
      );
    }
    return (
      <>
        <ul className="ck-mini">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{videos[i]?.title || tk(`cockpit.materials.v${i + 1}`)}</span>
              <span className="ck-mono">
                {videos[i]?.youtubeId ? '' : t('cockpit.materials.soon')}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => setStage(4)}
          sx={{ mt: 2, minHeight: 44 }}
        >
          {t('cockpit.materials.open')}
        </Button>
      </>
    );
  };

  const TABS: ReadonlyArray<[Tab, string]> = [
    ['ov', t('cockpit.tabs.overview')],
    ['qs', t('cockpit.tabs.questions')],
    ['rp', t('cockpit.tabs.report')],
    ['rs', t('cockpit.tabs.materials')],
  ];
  const greeting =
    hour === null
      ? ''
      : t(
          `cockpit.header.greeting${dayPart(hour) === 'morning' ? 'Morning' : dayPart(hour) === 'afternoon' ? 'Afternoon' : 'Evening'}`,
        );
  const railKeys = RAIL.filter((k) => k !== 'progress' || signed);
  const current: RailKey =
    view === 'progress'
      ? 'progress'
      : stageKey === 'journey'
        ? 'home'
        : stageKey === 'report'
          ? 'home'
          : (stageKey as RailKey);

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
            <span className="ck-mono">{t('cockpit.splash')}</span>
            <div className="ck-bar">
              <i />
            </div>
          </div>
        </div>
      )}
      <nav className="ck-rail" aria-label={t('cockpit.rail.aria')}>
        {railKeys.map((k) => (
          <button
            key={k}
            type="button"
            className="ck-rb"
            data-k={k}
            aria-current={k === current}
            onClick={() => goRail(k)}
          >
            {RAIL_ICONS[k]}
            <span>{t(`cockpit.rail.${k}`)}</span>
          </button>
        ))}
        <button
          type="button"
          className="ck-rb"
          data-k="lang"
          aria-label={`${t('common.language.label')} ${locale === 'en' ? 'FR' : 'EN'}`}
          onClick={() => startTransition(() => setLocaleAction(locale === 'en' ? 'fr' : 'en'))}
        >
          {RAIL_ICONS['lang']}
          <span>{locale === 'en' ? 'FR' : 'EN'}</span>
        </button>
        {!signed && <p className="ck-rail-note">{t('cockpit.rail.signInNote')}</p>}
      </nav>
      <div className="ck-col">
        <header className="ck-hd">
          <Logo />
          <div className="ck-tstrip" aria-hidden="true">
            <span>{t('cockpit.tagline.understand')}</span>
            <span>{t('cockpit.tagline.adapt')}</span>
            <span>{t('cockpit.tagline.evolve')}</span>
          </div>
          <div className="ck-hd-r">
            <span className="ck-mono ck-date" suppressHydrationWarning>
              {today}
            </span>
            {viewer.kind !== 'anon' && (
              <div
                className="ck-card ck-greet"
                style={{ padding: '6px 10px' }}
                data-testid="ck-greeting"
              >
                <span>
                  {greeting}
                  {viewer.name ? `, ${viewer.name}` : ''}
                </span>
                <span className="ck-mono">{t('cockpit.header.steps', { n: done })}</span>
                <div className="ck-bar">
                  <i style={{ width: `${(done / TOTAL_STEPS) * 100}%` }} />
                </div>
              </div>
            )}
            {viewer.kind === 'staff' && (
              <Button
                variant="outlined"
                component={Link}
                href="/admin/engagements"
                sx={{ minHeight: 44 }}
              >
                {t('cockpit.header.missions')}
              </Button>
            )}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <div className="ck-work">
          <main id="main" tabIndex={-1} className="ck-card ck-stage" ref={mainRef}>
            <div className="ck-st-h">
              <span className="ck-mono">
                {view === 'progress'
                  ? t('cockpit.progress.title')
                  : t('cockpit.stageOf', { n: si + 1, name: tk(`cockpit.stages.${stageKey}`) })}
              </span>
              {view === 'progress' ? (
                <Button variant="text" onClick={() => setView('stage')} sx={{ minHeight: 44 }}>
                  {t('cockpit.progress.backToStage')}
                </Button>
              ) : (
                <span className="ck-mono">
                  {stageKey === 'survey'
                    ? `${answered}/${total}`
                    : stageKey === 'learn'
                      ? `${lesson + 1}/5`
                      : ''}
                </span>
              )}
            </div>
            <div className="ck-st-b">
              <div key={fadeKey} className={fade ? 'ck-fade' : undefined}>
                {stageBody()}
              </div>
            </div>
            <div className="ck-ctl">
              <button
                type="button"
                className="ck-chip"
                aria-label={t('cockpit.previous')}
                onClick={() => setStage(si - 1)}
              >
                {ARROW_LEFT}
              </button>
              <div className="ck-dots">
                {STAGE_KEYS.map((k, i) => (
                  <button
                    key={k}
                    type="button"
                    aria-current={view === 'stage' && i === si}
                    aria-label={`${String(i + 1).padStart(2, '0')} · ${tk(`cockpit.stages.${k}`)}`}
                    onClick={() => setStage(i)}
                  >
                    {String(i + 1).padStart(2, '0')}
                    <span> · {tk(`cockpit.stages.${k}`)}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ck-chip"
                aria-label={t('cockpit.next')}
                onClick={() => setStage(si + 1)}
              >
                {ARROW_RIGHT}
              </button>
            </div>
          </main>
          <aside id="ck-side" className="ck-card ck-side">
            <div className="ck-tabs" role="tablist" aria-label={t('cockpit.tabs.aria')}>
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            {sideBody()}
          </aside>
        </div>
        <nav className="ck-strip" aria-label={t('cockpit.strip.aria')}>
          <ul className="ck-strip-l">
            {stepList(progress).map((s, i) => {
              const label =
                i < 5
                  ? t('cockpit.strip.lesson', { n: i + 1 })
                  : i === 5
                    ? t('cockpit.strip.yourTurn')
                    : t('cockpit.strip.lastStep');
              const sub =
                i === 2
                  ? t('cockpit.strip.questionsCount')
                  : i === 4
                    ? t('cockpit.strip.videosCount')
                    : i < 5
                      ? t('cockpit.strip.twoMin')
                      : i === 5
                        ? t('cockpit.strip.answered', { n: answered })
                        : t('cockpit.strip.signInHere');
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={`ck-card ck-lc${signed && next === undefined ? '' : signed && s === next ? ' next' : ''}`}
                    onClick={() => goStep(s)}
                  >
                    <span className="top">
                      <span className="ck-mono">{label}</span>
                      {tick(s.done)}
                    </span>
                    <b>{stepTitle(s)}</b>
                    <span className="ck-muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {sub}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <footer className="ck-foot">
          <span className="ck-mono">{t('cockpit.footer.line')}</span>
          <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
