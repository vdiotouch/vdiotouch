import { Env } from './env';

// Settings only the scaler uses; containers never see them.
const SCALER_ONLY_KEYS = new Set(['API_REPLICAS']);

/**
 * Env for a container: every string var / secret of this Worker (i.e. server/.env),
 * plus the pool's own overrides. Durable Object bindings are objects, so they are skipped.
 */
export const buildContainerEnv = (env: Env, overrides: Record<string, string> = {}): Record<string, string> => {
  const containerEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && !SCALER_ONLY_KEYS.has(key)) {
      containerEnv[key] = value;
    }
  }
  return { ...containerEnv, ...overrides };
};
