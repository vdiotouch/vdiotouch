import { Env } from './env';

/** Response row of GET /api/v1/processors/backlog (server/api ProcessorBacklogService). */
export interface PoolBacklog {
  pool: string;
  queues: string[];
  waiting: number;
  active: number;
  max: number;
  wanted: number;
}

const apiReplicaNames = (env: Env): string[] =>
  Array.from({ length: Math.max(1, Number(env.API_REPLICAS) || 1) }, (_, i) => `api-${i}`);

/** Every api replica's Durable Object, e.g. to keep them all running. */
export const getApiReplicas = (env: Env) => apiReplicaNames(env).map((name) => env.API_CONTAINER.getByName(name));

/** Sends a request to one api replica, picked at random. */
export const forwardToApi = (env: Env, request: Request): Promise<Response> => {
  const names = apiReplicaNames(env);
  const name = names[Math.floor(Math.random() * names.length)];
  return env.API_CONTAINER.getByName(name).fetch(request);
};

/** Calls an internal api endpoint straight through the container (no public hop). Throws on a non-2xx reply. */
export const callApi = async (env: Env, method: 'GET' | 'POST', path: string): Promise<unknown> => {
  const request = new Request(`http://api${path}`, {
    method,
    headers: { 'x-internal-api-key': env.INTERNAL_API_KEY },
  });
  const response = await forwardToApi(env, request);
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
};

export const fetchAllBacklogs = async (env: Env): Promise<PoolBacklog[]> => {
  const body = (await callApi(env, 'GET', '/api/v1/processors/backlog')) as { pools: PoolBacklog[] };
  return body.pools;
};

export const fetchBacklog = async (env: Env, pool: string): Promise<PoolBacklog> =>
  (await callApi(env, 'GET', `/api/v1/processors/backlog?pool=${encodeURIComponent(pool)}`)) as PoolBacklog;
