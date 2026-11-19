import { Env } from './env';
import { callApi, getApiReplicas } from './api-client';
import { scaleAllPools } from './scale-pools';

// Must match "triggers.crons" in wrangler.jsonc.
export const CRONS = {
  // Keep the api up and scale every pool. Backstop for lost webhooks and for jobs workers add themselves.
  EVERY_MINUTE: '* * * * *',
  // Replaces server/scripts/sla-check.sh and verify-bullmq-jobs.sh.
  EVERY_5_MINUTES: '*/5 * * * *',
  // Replaces server/scripts/cleanup.sh.
  HOURLY: '0 * * * *',
};

// One failing step is logged and does not stop the others.
const runStep = async (name: string, step: () => Promise<unknown>) => {
  try {
    await step();
  } catch (err) {
    console.log(`cron step "${name}" failed:`, err);
  }
};

export const runCron = async (cron: string, env: Env) => {
  switch (cron) {
    case CRONS.EVERY_MINUTE:
      await runStep('keep api running', () => Promise.all(getApiReplicas(env).map((api) => api.ensureRunning())));
      await runStep('scale pools', () => scaleAllPools(env));
      return;
    case CRONS.EVERY_5_MINUTES:
      await runStep('sla check', () => callApi(env, 'POST', '/api/v1/sla/check'));
      await runStep('verify bullmq jobs', () => callApi(env, 'POST', '/api/v1/cron-jobs/verify-bullmq-jobs'));
      return;
    case CRONS.HOURLY:
      await runStep('cleanup device', () => callApi(env, 'POST', '/api/v1/cron-jobs/cleanup-device'));
      return;
    default:
      console.log(`no handler for cron "${cron}"`);
  }
};
