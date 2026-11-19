// processor-scaler: the public front door of the api, plus the autoscaler for every worker pool.
//   POST /__scaler/scale  webhook from the api (SCALE_WEBHOOK_URL) -> scale one pool now
//   everything else       proxied to an api container
//   cron                  see crons.ts
import { Env } from './env';
import { fetchBacklog, forwardToApi } from './api-client';
import { scalePool } from './scale-pools';
import { runCron } from './crons';

export { ApiContainer } from './api-container';
export {
  AudioContainer,
  DownloadContainer,
  ProcessVideoContainer,
  ThumbnailContainer,
  UploadContainer,
  ValidateContainer,
} from './pool-container';

const SCALE_WEBHOOK_PATH = '/__scaler/scale';

const isAuthorized = (request: Request, token: string): boolean => {
  const provided = new TextEncoder().encode(request.headers.get('authorization') ?? '');
  const expected = new TextEncoder().encode(`Bearer ${token}`);
  return provided.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(provided, expected);
};

const handleScaleWebhook = async (request: Request, env: Env): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  if (!env.SCALE_WEBHOOK_TOKEN || !isAuthorized(request, env.SCALE_WEBHOOK_TOKEN)) {
    return new Response('unauthorized', { status: 401 });
  }
  const { pool } = (await request.json()) as { pool?: string };
  if (!pool) {
    return Response.json({ message: 'pool is required' }, { status: 400 });
  }
  // Re-read the backlog instead of trusting the body, so the webhook and the cron share one code path.
  const result = await scalePool(env, await fetchBacklog(env, pool));
  return Response.json(result);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === SCALE_WEBHOOK_PATH) {
      return handleScaleWebhook(request, env);
    }
    return forwardToApi(env, request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(controller.cron, env));
  },
} satisfies ExportedHandler<Env>;
