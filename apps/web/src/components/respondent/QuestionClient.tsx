'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Button from '@mui/material/Button';
import { ARROW_LEFT, ARROW_RIGHT, CHECK, EDIT, SHIELD } from '@/components/chrome/cockpit/icons';
import PrimaryButton from '@/components/chrome/cockpit/PrimaryButton';
import { finishRequest } from './finishRequest';

interface Option {
  readonly value: string;
  readonly label: string;
}

interface Props {
  token: string;
  index: number;
  prompt: string;
  helper: string | null;
  options: ReadonlyArray<Option>;
  /** Pre-selected value if the user resumed. */
  initialChoice: string | null;
  nextHref: string;
  /** Previous question, or null on the first one. */
  backHref: string | null;
  /** One progress segment per question: a link when the person may go back to it (TASK-AI L3). */
  segments: ReadonlyArray<{ readonly href: string | null; readonly on: boolean }>;
  labels: {
    title: string;
    count: string;
    progress: string;
    previous: string;
    next: string;
    finish: string;
    pick: string;
    saved: string;
    goTo: string;
  };
  /** The last question: after its answer or skip is saved, the survey is finished explicitly. */
  isLast: boolean;
  skipLabel: string;
  messages: {
    saving: string;
    saveFailed: string;
    alreadyFinished: string;
    incomplete: string;
    finishFailed: string;
  };
  /** Free-text question: a text box instead of options (TASK-Z2). */
  text?: {
    initial: string;
    maxLength: number;
    hint: string;
    optionalLabel: string;
    /** Counter text with a `{n}` placeholder for the current length. */
    counterTemplate: string;
  };
}

/**
 * Client island that renders one question in the Workbench's question card (TASK-AI L3): pick an
 * option, then Next saves it via /api/answer and moves on; Previous and the progress segments go
 * back. A failed save keeps the person on the question with a plain message and the pick kept.
 */
export default function QuestionClient(props: Props) {
  const [selected, setSelected] = useState<string | null>(props.initialChoice);
  const [saving, setSaving] = useState(false);
  const [navigating, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const [typed, setTyped] = useState(props.text?.initial ?? '');
  const router = useRouter();
  const busy = saving || navigating;

  const goTo = (href: string) => startTransition(() => router.push(href));

  /** Save through `url`, then move on; the last question finishes the survey first. */
  const saveAndContinue = async (url: string, payload: object) => {
    if (busy) return;
    setFailed(null);
    setSaving(true);
    const doneHref = `/s/${props.token}/done`;
    let status = 0;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: props.token, index: props.index, ...payload }),
      });
      status = r.status;
    } catch {
      // network error: status stays 0
    }
    if (status === 409) {
      // The survey is already finished: say so plainly, never blame the connection.
      setSaving(false);
      setFailed(props.messages.alreadyFinished);
      goTo(doneHref);
      return;
    }
    if (status < 200 || status >= 300) {
      setSaving(false);
      setFailed(props.messages.saveFailed);
      return;
    }
    if (!props.isLast) {
      setSaving(false);
      goTo(props.nextHref);
      return;
    }
    const finished = await finishRequest(props.token);
    setSaving(false);
    if (finished.kind === 'done') goTo(doneHref);
    else if (finished.kind === 'incomplete') {
      setFailed(props.messages.incomplete);
      goTo(`/s/${props.token}/q/${finished.missingIndex}`);
    } else setFailed(props.messages.finishFailed);
  };

  const choose = (choice: string) => {
    if (busy) return;
    setFailed(null);
    setSelected(choice);
  };

  // An empty box is a skip: nothing is saved as an answer, the question is marked passed.
  const submitText = () => {
    if (busy) return;
    const text = typed.trim();
    void (text.length === 0
      ? saveAndContinue('/api/skip', {})
      : saveAndContinue('/api/answer', { text }));
  };

  const ready = props.text !== undefined || selected !== null;
  const next = () => {
    if (props.text) submitText();
    else if (selected !== null) void saveAndContinue('/api/answer', { choice: selected });
  };
  const L = props.labels;

  return (
    <section
      className="ck-card ck-try"
      aria-labelledby="question-prompt"
      aria-busy={busy}
      data-testid="survey-card"
    >
      <div className="ck-try-head">
        <h2>
          {EDIT}
          <span>{L.title}</span>
        </h2>
        <span
          className="ck-count"
          role="progressbar"
          aria-label={L.progress}
          aria-valuemin={1}
          aria-valuemax={props.segments.length}
          aria-valuenow={props.index + 1}
          aria-valuetext={L.count}
          data-testid="survey-count"
        >
          {L.count}
        </span>
      </div>
      <div className="ck-try-body">
        <nav
          className={props.segments.length > 10 ? 'ck-qbar ck-qbar-rows' : 'ck-qbar'}
          aria-label={L.progress}
        >
          {props.segments.map((seg, i) =>
            seg.href && i !== props.index ? (
              <Link
                key={i}
                href={seg.href}
                className={seg.on ? 'on' : undefined}
                aria-label={L.goTo.replace('{n}', String(i + 1))}
                data-testid="survey-step"
              >
                <i />
              </Link>
            ) : (
              <span
                key={i}
                className={seg.on ? 'on' : undefined}
                aria-current={i === props.index ? 'step' : undefined}
                data-testid="survey-step"
              >
                <i />
              </span>
            ),
          )}
        </nav>
        <h1 id="question-prompt" className="ck-q prompt">
          {props.prompt}
        </h1>
        {props.helper ? <p className="ck-muted ck-small">{props.helper}</p> : null}
        {props.text ? (
          <div className="text-answer">
            <textarea
              className="text-answer-input"
              aria-labelledby="question-prompt"
              aria-describedby="text-hint text-counter"
              rows={5}
              maxLength={props.text.maxLength}
              value={typed}
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
            />
            <p id="text-hint" className="ck-muted ck-small ck-mt">
              {props.text.optionalLabel} · {props.text.hint}
            </p>
            <p id="text-counter" className="ck-muted ck-small text-counter">
              {props.text.counterTemplate.replace('{n}', String(typed.length))}
            </p>
          </div>
        ) : (
          <div className="ck-opts" role="radiogroup" aria-labelledby="question-prompt">
            {props.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="ck-opt"
                role="radio"
                aria-checked={selected === option.value}
                disabled={busy}
                onClick={() => choose(option.value)}
              >
                <span className="box">{CHECK}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="ck-try-row">
          {props.backHref && (
            <Button
              variant="outlined"
              color="inherit"
              href={props.backHref}
              disabled={busy}
              data-testid="survey-prev"
            >
              {ARROW_LEFT}
              {L.previous}
            </Button>
          )}
          <PrimaryButton
            className="text-next"
            disabled={!ready || busy}
            onClick={next}
            data-testid="survey-next"
          >
            {props.isLast ? L.finish : L.next}
            {ARROW_RIGHT}
          </PrimaryButton>
        </div>
        <p className="ck-hint" aria-live="polite">
          {SHIELD}
          <span>{busy ? props.messages.saving : ready ? L.saved : L.pick}</span>
        </p>
        {failed ? (
          <p role="alert" className="alert">
            {failed}
          </p>
        ) : null}
        {/* Every question can be skipped, choices too (ESN pilot rehearsal, ADR 0062). */}
        <div className="ck-try-nav">
          <Button
            variant="text"
            color="inherit"
            disabled={busy}
            onClick={() => void saveAndContinue('/api/skip', {})}
            sx={{ minHeight: 44, ml: 'auto' }}
            data-testid="survey-skip"
          >
            {props.skipLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
