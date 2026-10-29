import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Horizon, Quadrant, ReportSnapshot } from '@evolai/contracts';
import { formatDate, type SupportedLocale, type Translator } from '@evolai/i18n';
import { palette } from '@evolai/ui/palette';
import { findingLine, measureLine, weightsSentence } from './reportModel';

/**
 * Server-side PDF of a published audit report (TASK-V, ADR 0042).
 *
 * pdfkit draws the frozen snapshot only, so the PDF says exactly what the client page says:
 * aggregates, no answer, no quote, no per-person value. One font (Inter, two weights, from the
 * design system), colours from the light palette tokens, A4 with page numbers, readable on paper.
 * Memory stays low: one document in memory, no headless browser.
 */

// TTF copies of the same OFL Inter subset (fontkit cannot subset these WOFF2 files for a PDF).
const FONT_FILES = { regular: 'inter-latin-400.ttf', bold: 'inter-latin-600.ttf' } as const;

/** The design-system font files, wherever the app runs (local, CI, the deployed function). */
const fontDir = (): string => {
  const candidates = [
    path.join(process.cwd(), '..', '..', 'packages', 'ui', 'pdf-fonts'),
    path.join(process.cwd(), 'packages', 'ui', 'pdf-fonts'),
    path.join(process.cwd(), 'node_modules', '@evolai', 'ui', 'pdf-fonts'),
  ];
  const found = candidates.find((d) => existsSync(path.join(d, FONT_FILES.regular)));
  if (!found) throw new Error('report pdf: font files not found');
  return found;
};

let fonts: { regular: Buffer; bold: Buffer } | null = null;
const loadFonts = () => {
  if (!fonts) {
    const dir = fontDir();
    fonts = {
      regular: readFileSync(path.join(dir, FONT_FILES.regular)),
      bold: readFileSync(path.join(dir, FONT_FILES.bold)),
    };
  }
  return fonts;
};

const C = palette.light;
const QUADRANTS: readonly Quadrant[] = ['quick_win', 'big_bet', 'fill_in', 'reconsider'];
const HORIZONS: readonly Horizon[] = ['d30', 'd60', 'd90'];

const SIZE = { title: 20, section: 14, card: 11.5, body: 10.5, small: 9 } as const;
const MARGIN = 56;

export interface PdfOptions {
  /** Off in tests so the output can be inspected; on otherwise. */
  readonly compress?: boolean;
}

export const renderReportPdf = (
  s: ReportSnapshot,
  t: Translator,
  locale: SupportedLocale,
  opts: PdfOptions = {},
): Promise<Buffer> => {
  const f = loadFonts();
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN + 16, left: MARGIN, right: MARGIN },
    bufferPages: true,
    compress: opts.compress ?? true,
    font: f.regular as unknown as string,
    lang: s.locale,
    displayTitle: true,
    info: { Title: s.title, Author: s.organisation, Subject: t('report.view.clientTitle') },
  });
  doc.registerFont('regular', f.regular);
  doc.registerFont('bold', f.bold);

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - MARGIN * 2;
  const bottom = () => doc.page.height - MARGIN - 16;
  const ensure = (space: number) => {
    if (doc.y + space > bottom()) doc.addPage();
  };
  const text = (
    value: string,
    o: { size?: number; bold?: boolean; colour?: string; gap?: number; indent?: number } = {},
  ) => {
    doc
      .font(o.bold ? 'bold' : 'regular')
      .fontSize(o.size ?? SIZE.body)
      .fillColor(o.colour ?? C.fg)
      .text(value, MARGIN + (o.indent ?? 0), doc.y, {
        width: width - (o.indent ?? 0),
        lineGap: 2,
      });
    doc.moveDown(o.gap ?? 0.3);
  };
  const heading = (value: string) => {
    ensure(70);
    doc.moveDown(0.6);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + width, doc.y)
      .lineWidth(0.5)
      .strokeColor(C.border)
      .stroke();
    doc.moveDown(0.5);
    text(value, { size: SIZE.section, bold: true, colour: C.accentInk, gap: 0.4 });
  };
  const bullet = (value: string, indent = 0, colour: string = C.fg) => {
    ensure(28);
    text(`•  ${value}`, { indent: indent + 6, colour });
  };
  const lvl = (l: 'low' | 'medium' | 'high') => t(`report.steps.level.${l}`).toLowerCase();
  const colon = locale === 'fr' ? ' : ' : ': ';
  const findingNo = new Map(s.findings.map((x, i) => [x.key, i + 1]));
  const date = formatDate(locale, s.publishedAt, { dateStyle: 'long' });

  // Title block
  text(s.organisation, { colour: C.muted, size: SIZE.small });
  text(s.title, { size: SIZE.title, bold: true, gap: 0.2 });
  text(
    `${t('report.view.version', { version: s.version, date })} · ${t('report.view.aggregateNote')}`,
    { colour: C.muted, size: SIZE.small, gap: 0.8 },
  );

  // Summary
  heading(t('report.view.summary'));
  text(s.summary);
  if (s.summaryCitations.length > 0) {
    text(
      t('report.view.sources', {
        list: s.summaryCitations
          .map((c) => t('report.view.finding', { n: findingNo.get(c) ?? 0 }))
          .join(', '),
      }),
      { colour: C.muted, size: SIZE.small },
    );
  }

  // Readiness
  heading(t('report.readiness.title'));
  text(t('report.readiness.subtitle', { n: s.minGroupSize }), {
    colour: C.muted,
    size: SIZE.small,
  });
  const o = s.readiness.overall;
  if (o && o.overall !== null && o.level) {
    text(
      `${t('report.readiness.overall')} · ${t('report.readiness.people', { count: o.people })}`,
      { colour: C.muted },
    );
    text(t('report.readiness.scoreOf', { score: o.overall }), {
      size: SIZE.title,
      bold: true,
      gap: 0.1,
    });
    text(t(`report.readiness.level.${o.level}`), { bold: true, size: SIZE.card, gap: 0.1 });
    text(t(`report.readiness.levelMeaning.${o.level}`), { colour: C.muted, gap: 0.6 });
    for (const a of o.axes) {
      ensure(36);
      text(
        `${t(`report.readiness.axis.${a.axis}`)}${colon}${
          a.score === null
            ? t('report.readiness.noAxis')
            : `${t('report.readiness.scoreOf', { score: a.score })} · ${t(`report.readiness.level.${a.level ?? 'L0'}`)}`
        }`,
        { bold: true, gap: 0 },
      );
      text(t(`report.readiness.axisHelp.${a.axis}`), { colour: C.muted, size: SIZE.small });
    }
  } else {
    text(t('report.readiness.noScore', { n: s.minGroupSize }));
  }
  if (s.readiness.teams.length > 1) {
    doc.moveDown(0.3);
    for (const tm of s.readiness.teams) {
      bullet(
        `${tm.team} · ${t('report.readiness.people', { count: tm.people })}${colon}${
          tm.overall ?? '—'
        }${
          tm.axes.length > 0
            ? ` (${tm.axes.map((a) => `${t(`report.readiness.axis.${a.axis}`)} ${a.score ?? '—'}`).join(', ')})`
            : ''
        }`,
      );
    }
  }
  doc.moveDown(0.3);
  if (s.readiness.hiddenTeams > 0) {
    text(t('report.readiness.hiddenTeams', { count: s.readiness.hiddenTeams }), {
      colour: C.muted,
      size: SIZE.small,
    });
  }
  for (const line of [
    weightsSentence(t, s.readiness),
    t('report.readiness.scale'),
    t('report.readiness.notHr'),
  ]) {
    text(line, { colour: C.muted, size: SIZE.small });
  }

  // Findings
  heading(t('report.findings.title'));
  text(t('report.findings.subtitle', { n: s.minGroupSize }), { colour: C.muted, size: SIZE.small });
  if (s.findings.length === 0) text(t('report.findings.empty'));
  s.findings.forEach((x, i) => {
    ensure(28);
    text(`${i + 1}. ${x.label}`, { gap: 0 });
    text(findingLine(t, x), {
      colour: C.muted,
      size: SIZE.small,
      indent: 14,
    });
  });

  // Ranking: the 2 x 2 matrix, then the ordered list with its steps
  heading(t('report.ranking.title'));
  text(t('report.ranking.subtitle'), { colour: C.muted, size: SIZE.small });
  ensure(190);
  const cellW = (width - 8) / 2;
  const cellH = 84;
  const top = doc.y + 4;
  QUADRANTS.forEach((q, i) => {
    const x = MARGIN + (i % 2) * (cellW + 8);
    const y = top + Math.floor(i / 2) * (cellH + 8);
    doc.roundedRect(x, y, cellW, cellH, 6).lineWidth(0.75).strokeColor(C.borderStrong).stroke();
    doc
      .font('bold')
      .fontSize(SIZE.card)
      .fillColor(C.fg)
      .text(t(`report.ranking.quadrant.${q}`), x + 10, y + 8, { width: cellW - 20 });
    doc
      .font('regular')
      .fontSize(SIZE.small)
      .fillColor(C.muted)
      .text(t(`report.ranking.quadrantHelp.${q}`), x + 10, doc.y + 1, { width: cellW - 20 });
    const ranks = s.opportunities.filter((op) => op.quadrant === q).map((op) => String(op.rank));
    doc
      .font('bold')
      .fontSize(SIZE.card)
      .fillColor(C.accentInk)
      .text(ranks.join('  ·  ') || '—', x + 10, y + cellH - 22, { width: cellW - 20 });
  });
  doc.y = top + cellH * 2 + 8 + 14;
  doc.x = MARGIN;
  for (const op of s.opportunities) {
    ensure(60);
    text(`${op.rank}. ${op.title}`, { bold: true, size: SIZE.card, gap: 0 });
    text(
      `${t(`report.ranking.quadrant.${op.quadrant}`)} · ${t('report.ranking.impactEffort', {
        impact: lvl(op.impact),
        effort: lvl(op.effort),
      })}`,
      { colour: C.muted, size: SIZE.small, gap: 0.3 },
    );
    for (const st of s.steps.filter((x) => x.opportunityId === op.id)) {
      ensure(50);
      text(`${st.title} · ${t(`report.steps.categoryName.${st.category}`)}`, {
        bold: true,
        indent: 14,
        gap: 0,
      });
      if (st.description) text(st.description, { indent: 14, gap: 0 });
      text(
        [
          `${t('report.steps.owner')}${colon}${st.owner || '—'}`,
          t(`report.steps.horizonName.${st.horizon}`),
          `${t('report.steps.effort')} ${lvl(st.effort)}`,
          `${t('report.steps.impact')} ${lvl(st.impact)}`,
          `${t('report.steps.risk')} ${lvl(st.risk)}`,
        ].join(' · '),
        { colour: C.muted, size: SIZE.small, indent: 14, gap: 0.5 },
      );
      const measure = measureLine(t, st.measure, colon);
      if (measure) text(measure, { colour: C.muted, size: SIZE.small, indent: 14, gap: 0.5 });
    }
  }

  // Plan
  if (s.plan.length > 0) heading(t('report.plan.title'));
  for (const h of HORIZONS) {
    const items = s.plan.filter((p) => p.horizon === h);
    if (items.length === 0) continue;
    ensure(40);
    text(t(`report.steps.horizonName.${h}`), { bold: true, size: SIZE.card, gap: 0.2 });
    for (const p of items) bullet(p.owner ? `${p.text} · ${p.owner}` : p.text);
    doc.moveDown(0.3);
  }

  // Risks and prerequisites
  heading(t('report.view.risksTitle'));
  if (s.risks.length === 0) text(t('report.view.noRisks'));
  for (const r of s.risks) bullet(r);
  if (s.prerequisites.length > 0) {
    doc.moveDown(0.4);
    text(t('report.view.prerequisitesTitle'), { bold: true, size: SIZE.card, gap: 0.2 });
    for (const p of s.prerequisites) bullet(p);
  }

  // Method and privacy
  heading(t('report.view.methodTitle'));
  if (s.methodology) text(s.methodology);
  text(t('report.view.privacyNote', { n: s.minGroupSize }), { colour: C.muted, size: SIZE.small });

  // Page numbers and a running title on every page.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Writing below the bottom margin would make pdfkit open a new page: lift it for the footer.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGIN + 8;
    doc
      .font('regular')
      .fontSize(SIZE.small)
      .fillColor(C.muted)
      .text(s.title, MARGIN, y, { width: width * 0.7, lineBreak: false, ellipsis: true })
      .text(t('report.view.page', { page: i - range.start + 1, pages: range.count }), MARGIN, y, {
        width,
        align: 'right',
        lineBreak: false,
      });
  }
  doc.end();
  return done;
};
