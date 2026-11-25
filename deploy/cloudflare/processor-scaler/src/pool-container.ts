import { DurableObject } from 'cloudflare:workers';
import { Env } from './env';
import { buildContainerEnv } from './container-env';
import { getContainer, keepAlive, startContainer } from './container-lifecycle';

// A running slot is stopped once its pool has had no waiting or active job for this long. Well above the
// workers' own WORKER_IDLE_EXIT_SEC, so a healthy worker always exits by itself first; this only catches a
// worker that wrongly believes it is busy (and that the keep-alive alarm would otherwise keep alive forever).
const POOL_IDLE_STOP_MS = 10 * 60 * 1000;
// After SIGTERM, how long the worker gets to shut down before the container is destroyed.
const STOP_GRACE_MS = 30 * 1000;
const SIGTERM = 15;

// Durable Object storage keys.
const POOL_IDLE_SINCE_KEY = 'pool_idle_since';
const STOP_SIGNALLED_AT_KEY = 'stop_signalled_at';

/**
 * One replica slot of a worker pool, e.g. "transcode-720p-3".
 * Starts its container when the scaler asks, keeps it alive while it runs, and does nothing once the
 * worker exits by itself (WORKER_IDLE_EXIT_SEC). The slot is then free for the next start.
 * If the worker never exits while its pool stays idle, the slot stops it (see syncPoolState).
 */
export class PoolContainer extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    if (ctx.container?.running) {
      void ctx.blockConcurrencyWhile(() => keepAlive(ctx));
    }
  }

  async start(poolEnv: Record<string, string>): Promise<void> {
    await this.ctx.storage.delete([POOL_IDLE_SINCE_KEY, STOP_SIGNALLED_AT_KEY]);
    await startContainer(this.ctx, buildContainerEnv(this.env, poolEnv), this.slotName());
  }

  /**
   * Called by the scaler every minute for every slot of the pool. `poolIdle` = the pool has no waiting or
   * active job, so no worker of the pool is doing anything. A slot that keeps running through
   * POOL_IDLE_STOP_MS of that is stopped: SIGTERM first, destroyed STOP_GRACE_MS later if still running.
   * Returns whether the container is (still) running.
   */
  async syncPoolState(poolIdle: boolean): Promise<boolean> {
    const container = getContainer(this.ctx);
    // Leftover keys of a stopped container are cleared by start(); leave storage alone on this hot path.
    if (!container.running) {
      return false;
    }

    // Once a stop has begun it is finished whatever the pool does now: a worker that ignored SIGTERM
    // would otherwise hold the slot and keep the scaler from starting a healthy one.
    const stopSignalledAt = await this.ctx.storage.get<number>(STOP_SIGNALLED_AT_KEY);
    if (stopSignalledAt !== undefined) {
      if (Date.now() - stopSignalledAt >= STOP_GRACE_MS) {
        console.log(`${this.slotName()}: still running ${STOP_GRACE_MS / 1000}s after SIGTERM, destroying`);
        await container.destroy();
        await this.ctx.storage.delete([POOL_IDLE_SINCE_KEY, STOP_SIGNALLED_AT_KEY]);
        return false;
      }
      return true;
    }

    const now = Date.now();
    const idleSince = await this.ctx.storage.get<number>(POOL_IDLE_SINCE_KEY);
    if (!poolIdle) {
      if (idleSince !== undefined) {
        await this.ctx.storage.delete(POOL_IDLE_SINCE_KEY);
      }
      return true;
    }
    if (idleSince === undefined) {
      await this.ctx.storage.put(POOL_IDLE_SINCE_KEY, now);
      return true;
    }
    if (now - idleSince < POOL_IDLE_STOP_MS) {
      return true;
    }
    const idleSec = Math.round((now - idleSince) / 1000);
    console.log(`${this.slotName()}: pool idle for ${idleSec}s but container still running, sending SIGTERM`);
    container.signal(SIGTERM);
    await this.ctx.storage.put(STOP_SIGNALLED_AT_KEY, now);
    return true;
  }

  async alarm(): Promise<void> {
    if (!getContainer(this.ctx).running) {
      console.log(`${this.slotName()}: container no longer running, slot is free`);
      return;
    }
    await keepAlive(this.ctx);
  }

  private slotName(): string {
    return this.ctx.id.name ?? this.ctx.id.toString();
  }
}

// One class per image: each wrangler.jsonc container entry links to its own exported class.
export class DownloadContainer extends PoolContainer {}
export class ValidateContainer extends PoolContainer {}
export class ThumbnailContainer extends PoolContainer {}
export class ProcessVideoContainer extends PoolContainer {}
export class UploadContainer extends PoolContainer {}
export class AudioContainer extends PoolContainer {}
