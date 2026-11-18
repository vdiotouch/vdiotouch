import { DurableObject } from 'cloudflare:workers';
import { Env } from './env';
import { buildContainerEnv } from './container-env';
import { getContainer, keepAlive, startContainer, waitUntilListening } from './container-lifecycle';

// NestJS boot + Mongo / Redis / RabbitMQ connects.
const API_BOOT_TIMEOUT_MS = 90 * 1000;

/**
 * One always-on api replica ("api-0", "api-1", …). Proxies HTTP to the NestJS api inside its container,
 * and restarts the container from its alarm if it ever stops. Unlike a pool slot, it never scales to 0.
 */
export class ApiContainer extends DurableObject<Env> {
  private listening = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    if (ctx.container?.running) {
      void ctx.blockConcurrencyWhile(() => keepAlive(ctx));
    }
  }

  async ensureRunning(): Promise<void> {
    const container = getContainer(this.ctx);
    if (!container.running) {
      this.listening = false;
      await startContainer(this.ctx, buildContainerEnv(this.env), this.replicaName());
    }
    if (!this.listening) {
      await waitUntilListening(container, this.apiPort(), API_BOOT_TIMEOUT_MS);
      this.listening = true;
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureRunning();
    return getContainer(this.ctx).getTcpPort(this.apiPort()).fetch(request);
  }

  // Always on: keep alive while running, start again if the container stopped (crash, rollout).
  async alarm(): Promise<void> {
    if (!getContainer(this.ctx).running) {
      console.log(`${this.replicaName()}: container stopped, restarting`);
      await this.ensureRunning();
      return;
    }
    await keepAlive(this.ctx);
  }

  private apiPort(): number {
    return Number(this.env.API_PORT);
  }

  private replicaName(): string {
    return this.ctx.id.name ?? this.ctx.id.toString();
  }
}
