import { describe, expect, it } from 'vitest';
import {
  assertApproved,
  loadAiConfig,
  parseAiConfig,
  resolveRoute,
  RouteNotApprovedError,
} from './config.js';
import { testConfig } from './testFixtures.js';

const withAnthropic = () =>
  parseAiConfig({
    ...testConfig(),
    approvedRoutes: [
      ...testConfig().approvedRoutes,
      {
        provider: 'anthropic',
        model: 'example-model',
        region: 'eu-example',
        baseUrl: 'https://llm.example.test',
      },
    ],
  });

describe('AI config and route allowlist', () => {
  it('loads the bundled config, which only approves offline routes', () => {
    const cfg = loadAiConfig({});
    expect(cfg.approvedRoutes.map((r) => r.provider).sort()).toEqual(['mock', 'rule-based']);
  });

  it('defaults to the rule-based route', () => {
    const r = resolveRoute(testConfig(), {});
    expect(r.id).toBe('rule-based/v1');
    expect(r.apiKey).toBeNull();
  });

  it('resolves the mock route from env', () => {
    expect(resolveRoute(testConfig(), { EVOLAI_AI_PROVIDER: 'mock' }).id).toBe('mock/fixture-v1');
  });

  it('throws for a route that is not on the allowlist', () => {
    expect(() =>
      resolveRoute(testConfig(), {
        EVOLAI_AI_PROVIDER: 'anthropic',
        EVOLAI_AI_MODEL: 'example-model',
        EVOLAI_AI_REGION: 'eu-example',
        EVOLAI_AI_BASE_URL: 'https://llm.example.test',
        EVOLAI_AI_API_KEY: 'test-key',
      }),
    ).toThrow(RouteNotApprovedError);
  });

  it('throws for an unknown provider and for a missing model', () => {
    expect(() => resolveRoute(testConfig(), { EVOLAI_AI_PROVIDER: 'other' })).toThrow(
      RouteNotApprovedError,
    );
    expect(() => resolveRoute(withAnthropic(), { EVOLAI_AI_PROVIDER: 'anthropic' })).toThrow(
      /EVOLAI_AI_MODEL/,
    );
  });

  it('resolves an approved real route only when region and base URL match too', () => {
    const env = {
      EVOLAI_AI_PROVIDER: 'anthropic',
      EVOLAI_AI_MODEL: 'example-model',
      EVOLAI_AI_REGION: 'eu-example',
      EVOLAI_AI_BASE_URL: 'https://llm.example.test',
      EVOLAI_AI_API_KEY: 'test-key',
    };
    const r = resolveRoute(withAnthropic(), env);
    expect(r.id).toBe('anthropic/example-model');
    expect(r.apiKey).toBe('test-key');
    expect(() => resolveRoute(withAnthropic(), { ...env, EVOLAI_AI_REGION: 'us-example' })).toThrow(
      RouteNotApprovedError,
    );
    expect(() =>
      resolveRoute(withAnthropic(), { ...env, EVOLAI_AI_BASE_URL: 'https://other.example.test' }),
    ).toThrow(RouteNotApprovedError);
  });

  it('reads the dedicated ANTHROPIC_EVOLAI_API_KEY for Anthropic routes', () => {
    const r = resolveRoute(withAnthropic(), {
      EVOLAI_AI_PROVIDER: 'anthropic',
      EVOLAI_AI_MODEL: 'example-model',
      EVOLAI_AI_REGION: 'eu-example',
      EVOLAI_AI_BASE_URL: 'https://llm.example.test',
      ANTHROPIC_EVOLAI_API_KEY: 'test-dedicated-key',
    });
    expect(r.apiKey).toBe('test-dedicated-key');
  });

  it('requires a key for a real route', () => {
    expect(() =>
      resolveRoute(withAnthropic(), {
        EVOLAI_AI_PROVIDER: 'anthropic',
        EVOLAI_AI_MODEL: 'example-model',
        EVOLAI_AI_REGION: 'eu-example',
        EVOLAI_AI_BASE_URL: 'https://llm.example.test',
      }),
    ).toThrow(/EVOLAI_AI_API_KEY/);
  });

  it('assertApproved rejects a route removed from the config', () => {
    const route = {
      provider: 'mock' as const,
      model: 'fixture-v2',
      region: 'local',
      baseUrl: null,
    };
    expect(() => assertApproved(testConfig(), route)).toThrow(RouteNotApprovedError);
  });

  it('rejects a config with unknown keys', () => {
    expect(() => parseAiConfig({ ...testConfig(), extra: 1 })).toThrow();
  });
});

describe('OpenRouter model allowlist', () => {
  const via = (model: string) =>
    parseAiConfig({
      ...testConfig(),
      approvedRoutes: [
        ...testConfig().approvedRoutes,
        {
          provider: 'openai-compatible',
          model,
          region: 'eu-example',
          baseUrl: 'https://openrouter.ai/api/v1',
        },
      ],
    });
  const env = (model: string) => ({
    EVOLAI_AI_PROVIDER: 'openai-compatible',
    EVOLAI_AI_MODEL: model,
    EVOLAI_AI_REGION: 'eu-example',
    EVOLAI_AI_BASE_URL: 'https://openrouter.ai/api/v1',
    EVOLAI_AI_API_KEY: 'test-key',
  });

  it.each([
    'openai/o4-mini',
    'openai/o4-mini-high',
    'qwen/qwen3-vl-8b-instruct',
    'typesafe/jev-1.13',
  ])('allows %s', (m) => {
    expect(resolveRoute(via(m), env(m)).id).toBe(`openai-compatible/${m}`);
  });

  it.each([
    'anthropic/claude-sonnet-5.5',
    'minimax/minimax-m3',
    'openai/gpt-4.1-mini',
    'z-ai/glm-5.3',
  ])('rejects %s before any call', (m) => {
    expect(() => resolveRoute(via(m), env(m))).toThrow(RouteNotApprovedError);
    const route = via(m).approvedRoutes.at(-1)!;
    expect(() => assertApproved(via(m), route)).toThrow(/not allowed on OpenRouter/);
  });
});
