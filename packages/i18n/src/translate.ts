import type { SupportedLocale } from './index.js';
import { messages, type Messages } from './messages/index.js';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type MessageVars = Record<string, string | number>;
export type Translator = (key: MessageKey, vars?: MessageVars) => string;

/**
 * Tiny ICU subset: `{name}` placeholders and `{n, plural, one {…} other {…}}` (with `#` for the
 * number). Enough for our copy; parity tests keep both catalogs in sync (ADR 0024).
 */
export const formatMessage = (
  template: string,
  locale: SupportedLocale,
  vars: MessageVars = {},
): string => {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i] as string;
    if (ch !== '{') {
      out += ch;
      i += 1;
      continue;
    }
    let depth = 1;
    let j = i + 1;
    while (j < template.length && depth > 0) {
      if (template[j] === '{') depth += 1;
      else if (template[j] === '}') depth -= 1;
      j += 1;
    }
    const body = template.slice(i + 1, j - 1);
    const [name = '', kind, ...rest] = splitTop(body);
    const value = vars[name.trim()];
    if (kind?.trim() === 'plural') {
      const n = typeof value === 'number' ? value : Number(value);
      const branches = parseBranches(rest.join(','));
      const tag = locale === 'fr' ? 'fr-FR' : 'en-GB';
      const category = new Intl.PluralRules(tag).select(n);
      const chosen = branches[`=${n}`] ?? branches[category] ?? branches['other'] ?? '';
      // "1,5 heure" in French, "1.5 hours" in English (ESN review).
      const shown = new Intl.NumberFormat(tag, { useGrouping: false }).format(n);
      out += formatMessage(chosen.replace(/#/g, shown), locale, vars);
    } else {
      out += value === undefined ? `{${name.trim()}}` : String(value);
    }
    i = j;
  }
  return out;
};

const splitTop = (body: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (ch === ',' && depth === 0 && parts.length < 2) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts;
};

const parseBranches = (src: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const re = /\s*([=\w]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let k = re.lastIndex;
    while (k < src.length && depth > 0) {
      if (src[k] === '{') depth += 1;
      else if (src[k] === '}') depth -= 1;
      k += 1;
    }
    result[m[1] as string] = src.slice(re.lastIndex, k - 1);
    re.lastIndex = k;
  }
  return result;
};

const lookup = (catalog: unknown, key: string): string | undefined => {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
};

export const createTranslator =
  (locale: SupportedLocale): Translator =>
  (key, vars) =>
    formatMessage(lookup(messages[locale], key) ?? lookup(messages.en, key) ?? key, locale, vars);
