// CF-0 spike Worker: GET / starts one container and returns its connectivity report.
import { DurableObject } from 'cloudflare:workers';

const CHECK_PORT = 8080;
const BOOT_TIMEOUT_MS = 30_000;
const BOOT_RETRY_DELAY_MS = 500;

interface Env {
  CONNECTIVITY_CHECK: DurableObjectNamespace<ConnectivityCheckContainer>;
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS?: string;
  RABBIT_MQ_URL: string;
  MONGO_DB_URL: string;
}

export class ConnectivityCheckContainer extends DurableObject<Env> {
  async runCheck(): Promise<string> {
    const container = this.ctx.container;
    if (!container) {
      throw new Error('no container is configured for this Durable Object');
    }
    if (!container.running) {
      container.start({
        enableInternet: true,
        env: {
          REDIS_HOST: this.env.REDIS_HOST,
          REDIS_PORT: this.env.REDIS_PORT,
          REDIS_USERNAME: this.env.REDIS_USERNAME ?? '',
          REDIS_PASSWORD: this.env.REDIS_PASSWORD ?? '',
          REDIS_TLS: this.env.REDIS_TLS ?? 'false',
          RABBIT_MQ_URL: this.env.RABBIT_MQ_URL,
          MONGO_DB_URL: this.env.MONGO_DB_URL,
        },
      });
    }

    // `running` turns true before the process listens, so retry until the port answers.
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    for (;;) {
      try {
        const res = await container.getTcpPort(CHECK_PORT).fetch('http://container/check');
        return await res.text();
      } catch (err) {
        if (Date.now() > deadline) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, BOOT_RETRY_DELAY_MS));
      }
    }
  }
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const report = await env.CONNECTIVITY_CHECK.getByName('spike').runCheck();
    return new Response(report, { headers: { 'content-type': 'application/json' } });
  },
};
