#!/usr/bin/env node
/**
 * Apply the questionnaire definition to an engagement (TASK-Z2, ADR 0046). Idempotent, safe on the
 * live database, never a migration:
 *
 *   pnpm questionnaire:apply --engagement-id <uuid> [--expect-host <db host>]
 *
 * Edit the questions in packages/contracts/src/questionnaires/pilot-v2.json (see docs/RUNBOOK.md,
 * "Change the questions"), deploy, then run this once per engagement that has no answers yet.
 */
import pg from 'pg';
import { resolveTargetUrl } from './auditor-lib.mjs';
import { applyQuestionnaire, loadDefinition } from './questionnaire-lib.mjs';

const parseArgs = (argv) => {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const a = argv[i];
    const v = argv[i + 1];
    if (!a?.startsWith('--') || v === undefined || v.startsWith('--')) {
      throw new Error(`bad arguments near ${a ?? '(end)'}`);
    }
    out[a.slice(2)] = v;
  }
  return out;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const def = loadDefinition();
  if (!args['engagement-id']) throw new Error('--engagement-id is required');
  const client = new pg.Client({
    connectionString: resolveTargetUrl(process.env, args['expect-host']),
  });
  await client.connect();
  try {
    const out = await applyQuestionnaire(client, { engagementId: args['engagement-id'] }, def);
    process.stdout.write(
      `${JSON.stringify({ questionnaire: `${def.id}@${def.version}`, ...out }, null, 2)}\n`,
    );
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  process.stderr.write(
    `questionnaire:apply: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
