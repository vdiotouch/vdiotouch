import { DurableObject } from 'cloudflare:workers';
import { Env } from './env';
import { buildContainerEnv } from './container-env';
import { getContainer, keepAlive, startContainer } from './container-lifecycle';

/**
 * One replica slot of a worker pool, e.g. "transcode-720p-3".
 * Starts its container when the scaler asks, keeps it alive while it runs, and does nothing once the
 * worker exits by itself (WORKER_IDLE_EXIT_SEC). The slot is then free for the next start.
 */
export class PoolContainer extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    if (ctx.container?.running) {
      void ctx.blockConcurrencyWhile(() => keepAlive(ctx));
    }
  }

  isRunning(): boolean {
    return getContainer(this.ctx).running;
  }

  async start(poolEnv: Record<string, string>): Promise<void> {
    await startContainer(this.ctx, buildContainerEnv(this.env, poolEnv), this.slotName());
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
