import type { ApiContainer } from './api-container';
import type { PoolContainer } from './pool-container';

/** Durable Object namespaces with a worker image behind them, one per image. */
export interface PoolContainerBindings {
  DOWNLOAD_CONTAINER: DurableObjectNamespace<PoolContainer>;
  VALIDATE_CONTAINER: DurableObjectNamespace<PoolContainer>;
  THUMBNAIL_CONTAINER: DurableObjectNamespace<PoolContainer>;
  PROCESS_VIDEO_CONTAINER: DurableObjectNamespace<PoolContainer>;
  UPLOAD_CONTAINER: DurableObjectNamespace<PoolContainer>;
  AUDIO_CONTAINER: DurableObjectNamespace<PoolContainer>;
}

export type PoolContainerBinding = keyof PoolContainerBindings;

export interface Env extends PoolContainerBindings {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;

  // vars (wrangler.jsonc)
  API_REPLICAS: string;
  API_PORT: string;

  // secrets
  INTERNAL_API_KEY: string;
  SCALE_WEBHOOK_TOKEN: string;

  // Every other var / secret (the contents of server/.env) is passed to the containers as env.
  [key: string]: unknown;
}
