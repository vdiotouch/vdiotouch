import { PoolContainerBinding } from './env';
import { PoolBacklog } from './api-client';

/** How to run one worker pool: which image (container class) and which extra env. */
export interface PoolDefinition {
  binding: PoolContainerBinding;
  // Extra container env on top of server/.env.
  env?: (backlog: PoolBacklog) => Record<string, string>;
}

// One pool per height, all on the process-video-worker image. The api reports the pool's queue name,
// which the worker binds to at boot (@Processor(process.env.BULL_PROCESS_VIDEO_JOB_QUEUE)).
const TRANSCODE_POOL: PoolDefinition = {
  binding: 'PROCESS_VIDEO_CONTAINER',
  env: (backlog) => ({ WORKER_ROLE: 'transcode', BULL_PROCESS_VIDEO_JOB_QUEUE: backlog.queues[0] }),
};

/** Keyed by the pool names the api reports (server/api PROCESSOR_POOLS). */
export const POOLS: Record<string, PoolDefinition> = {
  download: { binding: 'DOWNLOAD_CONTAINER' },
  validate: { binding: 'VALIDATE_CONTAINER' },
  thumbnail: { binding: 'THUMBNAIL_CONTAINER' },
  'transcode-1080p': TRANSCODE_POOL,
  'transcode-720p': TRANSCODE_POOL,
  'transcode-540p': TRANSCODE_POOL,
  'transcode-480p': TRANSCODE_POOL,
  'transcode-360p': TRANSCODE_POOL,
  mp4: { binding: 'PROCESS_VIDEO_CONTAINER', env: () => ({ WORKER_ROLE: 'mp4' }) },
  upload: { binding: 'UPLOAD_CONTAINER' },
  audio: { binding: 'AUDIO_CONTAINER' },
};
