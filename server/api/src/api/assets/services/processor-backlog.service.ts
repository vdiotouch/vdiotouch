import { BadRequestException, Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { PROCESSOR_POOLS } from '@/src/common/constants';
import { PoolBacklog, ProcessorPool } from '@/src/api/assets/models/processor-pool.model';

// Redis commands wait (queued) while the connection is down; answer the autoscaler with an error instead of hanging.
const REDIS_TIMEOUT_MS = 10 * 1000;

/**
 * Reports, per worker pool, how many replicas are wanted right now.
 * Autoscalers (Cloudflare processor-scaler, later KEDA) read this instead of counting Redis keys themselves.
 */
@Injectable()
export class ProcessorBacklogService implements OnModuleInit {
  constructor(
    @InjectQueue('process_video_360p') private videoProcessQueue360p: Queue,
    @InjectQueue('process_video_480p') private videoProcessQueue480p: Queue,
    @InjectQueue('process_video_540p') private videoProcessQueue540p: Queue,
    @InjectQueue('process_video_720p') private videoProcessQueue720p: Queue,
    @InjectQueue('process_video_1080p') private videoProcessQueue1080p: Queue,
    @InjectQueue('thumbnail-generation') private thumbnailGenerationQueue: Queue,
    @InjectQueue('upload-video') private videoUploadQueue: Queue,
    @InjectQueue('validate-video') private validateVideoQueue: Queue,
    @InjectQueue('download-video') private downloadVideoQueue: Queue,
    @InjectQueue('download-file-generation') private downloadFileGenerationQueue: Queue,
    @InjectQueue('extract-audio') private audioExtractionQueue: Queue,
    @InjectQueue('audio-transcription') private audioTranscriptionQueue: Queue,
    @InjectQueue('audio-transcript-merge') private transcriptMergerQueue: Queue
  ) {}

  // Without a listener, a Redis connection error is never logged and every Redis call just waits.
  onModuleInit() {
    const config = AppConfigService.appConfig;
    console.log(
      `redis: ${config.REDIS_HOST}:${config.REDIS_PORT}, tls ${config.REDIS_TLS ? 'on' : 'off'}, ` +
        `bull prefix ${config.BULL_PREFIX}`
    );
    for (const pool of this.getPools()) {
      for (const queue of pool.queues) {
        queue.on('error', (err) => console.log(`redis error on queue ${queue.name}:`, err?.message ?? err));
      }
    }
  }

  getPools(): ProcessorPool[] {
    const config = AppConfigService.appConfig;
    return [
      {
        name: PROCESSOR_POOLS.DOWNLOAD,
        queues: [this.downloadVideoQueue],
        max_processors: config.DOWNLOAD_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.VALIDATE,
        queues: [this.validateVideoQueue],
        max_processors: config.VALIDATE_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.THUMBNAIL,
        queues: [this.thumbnailGenerationQueue],
        max_processors: config.THUMBNAIL_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.TRANSCODE_1080P,
        queues: [this.videoProcessQueue1080p],
        max_processors: config.TRANSCODE_1080P_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.TRANSCODE_720P,
        queues: [this.videoProcessQueue720p],
        max_processors: config.TRANSCODE_720P_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.TRANSCODE_540P,
        queues: [this.videoProcessQueue540p],
        max_processors: config.TRANSCODE_540P_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.TRANSCODE_480P,
        queues: [this.videoProcessQueue480p],
        max_processors: config.TRANSCODE_480P_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.TRANSCODE_360P,
        queues: [this.videoProcessQueue360p],
        max_processors: config.TRANSCODE_360P_MAX_PROCESSORS,
      },
      {
        name: PROCESSOR_POOLS.MP4,
        queues: [this.downloadFileGenerationQueue],
        max_processors: config.MP4_MAX_PROCESSORS,
      },
      { name: PROCESSOR_POOLS.UPLOAD, queues: [this.videoUploadQueue], max_processors: config.UPLOAD_MAX_PROCESSORS },
      {
        name: PROCESSOR_POOLS.AUDIO,
        queues: [this.audioExtractionQueue, this.audioTranscriptionQueue, this.transcriptMergerQueue],
        max_processors: config.AUDIO_MAX_PROCESSORS,
      },
    ];
  }

  async getAllBacklogs(): Promise<PoolBacklog[]> {
    return Promise.all(this.getPools().map((pool) => this.buildBacklog(pool)));
  }

  async getBacklog(poolName: string): Promise<PoolBacklog> {
    const pool = this.getPools().find((p) => p.name === poolName);
    if (!pool) {
      throw new BadRequestException(`unknown pool: ${poolName}`);
    }
    return this.buildBacklog(pool);
  }

  private async buildBacklog(pool: ProcessorPool): Promise<PoolBacklog> {
    let waiting = 0;
    let active = 0;
    for (const queue of pool.queues) {
      // Delayed jobs (retry backoff) are left out: a replica started for them would sit idle until the delay ends.
      const counts = await this.withRedisTimeout(queue.getJobCounts('waiting', 'prioritized', 'active'), queue.name);
      waiting += counts.waiting + counts.prioritized;
      active += counts.active;
    }
    return {
      pool: pool.name,
      queues: pool.queues.map((queue) => queue.name),
      waiting,
      active,
      max: pool.max_processors,
      wanted: Math.min(waiting + active, pool.max_processors),
    };
  }

  private withRedisTimeout<T>(promise: Promise<T>, queueName: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const { REDIS_HOST, REDIS_PORT, REDIS_TLS } = AppConfigService.appConfig;
        reject(
          new ServiceUnavailableException(
            `Redis did not answer within ${REDIS_TIMEOUT_MS / 1000}s (queue ${queueName}, ` +
              `${REDIS_HOST}:${REDIS_PORT}, tls ${REDIS_TLS ? 'on' : 'off'}). Check REDIS_HOST / REDIS_PORT / REDIS_TLS.`
          )
        );
      }, REDIS_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
}
