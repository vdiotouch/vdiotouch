import { DurableObject } from 'cloudflare:workers';
import { Env } from './env';
import { buildContainerEnv } from './container-env';
import { getContainer, isStartedWithEnv, keepAlive, startContainer, waitUntilListening } from './container-lifecycle';

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
    const containerEnv = buildContainerEnv(this.env);
    if (container.running && !(await isStartedWithEnv(this.ctx, containerEnv))) {
      // Vars or secrets changed since this container started (it only reads env at start): replace it.
      // blockConcurrencyWhile: requests arriving meanwhile wait instead of hitting a stopping container.
      await this.ctx.blockConcurrencyWhile(async () => {
        console.log(`${this.replicaName()}: settings changed since the container started, restarting it`);
        this.listening = false;
        await container.destroy('settings changed');
      });
    }
    if (!container.running) {
      this.listening = false;
      await startContainer(this.ctx, containerEnv, this.replicaName());
    }
    if (!this.listening) {
      await waitUntilListening(container, this.apiPort(), API_BOOT_TIMEOUT_MS);
      this.listening = true;
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureRunning();
    // Containers only accept plain HTTP from their Durable Object (the hop is already private), so the
    // browser's https:// URL is rewritten. Method, headers (incl. Authorization) and body stay the same.
    const containerUrl = new URL(request.url);
    containerUrl.protocol = 'http:';
    return getContainer(this.ctx).getTcpPort(this.apiPort()).fetch(new Request(containerUrl, request));
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
