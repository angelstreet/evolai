/**
 * AI route allowlist, cost caps and rates (TASK-H, ADR 0029, PRD §10 and §26.2).
 *
 * The public file `services/ai/config/ai.config.json` lists only the offline routes
 * (`rule-based/v1`, `mock/fixture-v1`). The owner turns on a real route by pointing
 * `EVOLAI_AI_CONFIG` at a private copy that adds the route and its timestamped rate, and by
 * setting the `EVOLAI_AI_*` variables below (the key: `EVOLAI_AI_API_KEY`, or for Anthropic
 * `ANTHROPIC_EVOLAI_API_KEY`). A route that is not in the allowlist throws:
 * the worker fails closed instead of calling an unapproved model.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const PROVIDER_KINDS = ['rule-based', 'mock', 'openai-compatible', 'anthropic'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

const routeSchema = z
  .object({
    provider: z.enum(PROVIDER_KINDS),
    model: z.string().min(1),
    region: z.string().min(1),
    baseUrl: z.string().url().nullable(),
  })
  .strict();

const rateSchema = z
  .object({
    provider: z.enum(PROVIDER_KINDS),
    model: z.string().min(1),
    effectiveFrom: z.string().datetime({ offset: true }),
    currency: z.string().length(3),
    inputPerMillionTokens: z.number().nonnegative(),
    outputPerMillionTokens: z.number().nonnegative(),
  })
  .strict();

const configSchema = z
  .object({
    $comment: z.string().optional(),
    approvedRoutes: z.array(routeSchema),
    /** The only models that may go through OpenRouter (owner, 2026-10-27). Lowercase ids. */
    openRouterModels: z
      .array(z.string().min(1))
      .default([
        'openai/o4-mini',
        'openai/o4-mini-high',
        'o4-mini',
        'qwen/qwen3-vl-8b-instruct',
        'typesafe/jev-1.13',
        'typesafe/jev-router',
      ]),
    caps: z
      .object({
        currency: z.string().length(3),
        maxInputTokensPerAnalysis: z.number().int().positive(),
        maxOutputTokensPerAnalysis: z.number().int().positive(),
        maxCostPerAnalysis: z.number().nonnegative(),
        maxCostPerTenantMonth: z.number().nonnegative(),
      })
      .strict(),
    rates: z.array(rateSchema),
  })
  .strict();

export type ApprovedRoute = z.infer<typeof routeSchema>;
export type ModelRate = z.infer<typeof rateSchema>;
export type AiConfig = z.infer<typeof configSchema>;

/** A route resolved from env and matched against the allowlist. */
export interface ResolvedRoute extends ApprovedRoute {
  /** Stored in `analyses.model_route`, e.g. `anthropic/claude-opus-5-5`. */
  readonly id: string;
  /** Read from env only; never stored, never logged. */
  readonly apiKey: string | null;
}

export class RouteNotApprovedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouteNotApprovedError';
  }
}

const BUNDLED_CONFIG = new URL('../../config/ai.config.json', import.meta.url);

export const parseAiConfig = (raw: unknown): AiConfig => configSchema.parse(raw);

export const loadAiConfig = (env: NodeJS.ProcessEnv = process.env): AiConfig => {
  const path = env['EVOLAI_AI_CONFIG'];
  const text = readFileSync(path ? path : BUNDLED_CONFIG, 'utf8');
  return parseAiConfig(JSON.parse(text));
};

const isOpenRouter = (baseUrl: string | null): boolean =>
  (baseUrl ?? '').toLowerCase().includes('openrouter.ai');

/** A route whose base URL is OpenRouter may name only an allowlisted model; every other model fails closed. */
export const assertOpenRouterModel = (config: AiConfig, route: ApprovedRoute): void => {
  if (!isOpenRouter(route.baseUrl)) return;
  const model = route.model.trim().toLowerCase();
  if (!config.openRouterModels.some((m) => m.toLowerCase() === model)) {
    throw new RouteNotApprovedError(
      `model "${route.model}" is not allowed on OpenRouter (allowed: ${config.openRouterModels.join(', ')})`,
    );
  }
};

const DEFAULTS: Record<'rule-based' | 'mock', { model: string; region: string }> = {
  'rule-based': { model: 'v1', region: 'local' },
  mock: { model: 'fixture-v1', region: 'local' },
};

/**
 * Resolve the route named by `EVOLAI_AI_PROVIDER`, `EVOLAI_AI_MODEL`, `EVOLAI_AI_REGION` and
 * `EVOLAI_AI_BASE_URL` against the allowlist. All four must match one approved entry.
 */
export const resolveRoute = (
  config: AiConfig,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedRoute => {
  const provider = (env['EVOLAI_AI_PROVIDER'] ?? 'rule-based') as ProviderKind;
  if (!PROVIDER_KINDS.includes(provider)) {
    throw new RouteNotApprovedError(`unknown AI provider "${provider}"`);
  }
  const fallback = provider === 'rule-based' || provider === 'mock' ? DEFAULTS[provider] : null;
  const model = env['EVOLAI_AI_MODEL'] ?? fallback?.model;
  const region = env['EVOLAI_AI_REGION'] ?? fallback?.region;
  const baseUrl = env['EVOLAI_AI_BASE_URL'] ?? null;
  if (!model || !region) {
    throw new RouteNotApprovedError(
      `EVOLAI_AI_MODEL and EVOLAI_AI_REGION are required for provider "${provider}"`,
    );
  }
  const match = config.approvedRoutes.find(
    (r) =>
      r.provider === provider && r.model === model && r.region === region && r.baseUrl === baseUrl,
  );
  if (!match) {
    throw new RouteNotApprovedError(
      `route ${provider}/${model} in region ${region} is not in the approved allowlist`,
    );
  }
  assertOpenRouterModel(config, match);
  const needsKey = provider === 'openai-compatible' || provider === 'anthropic';
  // EVOLAI_AI_API_KEY wins; for Anthropic the owner's dedicated ANTHROPIC_EVOLAI_API_KEY
  // (kept in a gitignored .env) is read when it is not set.
  const apiKey =
    env['EVOLAI_AI_API_KEY'] ??
    (provider === 'anthropic' ? env['ANTHROPIC_EVOLAI_API_KEY'] : undefined) ??
    null;
  if (needsKey && !apiKey) {
    throw new RouteNotApprovedError(`EVOLAI_AI_API_KEY is required for provider "${provider}"`);
  }
  return { ...match, id: `${provider}/${model}`, apiKey: needsKey ? apiKey : null };
};

/** Check, at call time, that a route is still approved. Used by every provider. */
export const assertApproved = (config: AiConfig, route: ApprovedRoute): void => {
  const ok = config.approvedRoutes.some(
    (r) =>
      r.provider === route.provider &&
      r.model === route.model &&
      r.region === route.region &&
      r.baseUrl === route.baseUrl,
  );
  if (!ok) {
    throw new RouteNotApprovedError(
      `route ${route.provider}/${route.model} in region ${route.region} is not in the approved allowlist`,
    );
  }
  assertOpenRouterModel(config, route);
};
