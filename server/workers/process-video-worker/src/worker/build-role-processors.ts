import { Type } from '@nestjs/common';
import { ProcessVideoWorker } from '@/src/worker/process-video.worker';
import { DownloadFileGenerationWorker } from '@/src/worker/download-file-generation.worker';

export const WORKER_ROLES = {
  ALL: 'all',
  TRANSCODE: 'transcode',
  MP4: 'mp4',
};

/**
 * Which Bull processors this replica registers, from WORKER_ROLE:
 * - all (default): both, as on docker-compose today
 * - transcode: HLS renditions only (one transcode pool per height)
 * - mp4: downloadable MP4 generation only (the mp4 pool)
 * Read straight from process.env because the module's providers are fixed when the module is defined,
 * the same way the @Processor queue names are.
 */
export const buildRoleProcessors = (role: string = WORKER_ROLES.ALL): Type[] => {
  switch (role) {
    case WORKER_ROLES.TRANSCODE:
      return [ProcessVideoWorker];
    case WORKER_ROLES.MP4:
      return [DownloadFileGenerationWorker];
    case WORKER_ROLES.ALL:
      return [ProcessVideoWorker, DownloadFileGenerationWorker];
    default:
      throw new Error(`unknown WORKER_ROLE: ${role}. Use one of: ${Object.values(WORKER_ROLES).join(', ')}`);
  }
};
