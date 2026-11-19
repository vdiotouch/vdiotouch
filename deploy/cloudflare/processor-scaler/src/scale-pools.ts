import { Env } from './env';
import { POOLS } from './pools';
import { PoolBacklog, fetchAllBacklogs } from './api-client';

export interface ScaleResult {
  pool: string;
  wanted: number;
  running: number;
  started: string[];
}

/**
 * Makes sure at least `wanted` slots of the pool are running. Slots are named "<pool>-0" … "<pool>-<max-1>",
 * so a pool can never run more than `max` containers. It only ever starts slots: running workers stop
 * themselves once the queue is empty (WORKER_IDLE_EXIT_SEC), so a job in progress is never cut off.
 */
export const scalePool = async (env: Env, backlog: PoolBacklog): Promise<ScaleResult> => {
  const result: ScaleResult = { pool: backlog.pool, wanted: backlog.wanted, running: 0, started: [] };
  const definition = POOLS[backlog.pool];
  if (!definition) {
    console.log(`unknown pool from api: ${backlog.pool}, skipped`);
    return result;
  }
  if (backlog.wanted === 0) {
    return result;
  }

  const namespace = env[definition.binding];
  const slotNames = Array.from({ length: backlog.max }, (_, i) => `${backlog.pool}-${i}`);
  const runningFlags = await Promise.all(slotNames.map((name) => namespace.getByName(name).isRunning()));
  result.running = runningFlags.filter(Boolean).length;

  const freeSlots = slotNames.filter((_, i) => !runningFlags[i]);
  const slotsToStart = freeSlots.slice(0, Math.max(0, backlog.wanted - result.running));
  const poolEnv = definition.env?.(backlog) ?? {};
  await Promise.all(slotsToStart.map((name) => namespace.getByName(name).start(poolEnv)));
  result.started = slotsToStart;

  if (slotsToStart.length) {
    console.log(`scaled ${backlog.pool}: wanted ${backlog.wanted}, running ${result.running}, started`, slotsToStart);
  }
  return result;
};

export const scaleAllPools = async (env: Env): Promise<ScaleResult[]> => {
  const backlogs = await fetchAllBacklogs(env);
  return Promise.all(backlogs.map((backlog) => scalePool(env, backlog)));
};
