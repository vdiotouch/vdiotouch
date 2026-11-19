import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@/src/common/app-config/environment';

@Injectable()
export class AppConfigService {
  public static appConfig: EnvironmentVariables;

  constructor(private configService: ConfigService<EnvironmentVariables>) {
    AppConfigService.appConfig = {
      PROCESS_VIDEO_WORKER_PORT: +this.configService.getOrThrow('PROCESS_VIDEO_WORKER_PORT'),
      RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE: this.configService.getOrThrow('RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE'),
      RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY: this.configService.getOrThrow(
        'RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY',
      ),
      RABBIT_MQ_URL: this.configService.getOrThrow('RABBIT_MQ_URL'),
      TEMP_VIDEO_DIRECTORY: this.configService.getOrThrow('TEMP_VIDEO_DIRECTORY'),
      BULL_PROCESS_VIDEO_JOB_QUEUE: this.configService.getOrThrow('BULL_PROCESS_VIDEO_JOB_QUEUE'),
      BULL_UPLOAD_JOB_QUEUE: this.configService.getOrThrow('BULL_UPLOAD_JOB_QUEUE'),
      REDIS_HOST: this.configService.getOrThrow('REDIS_HOST'),
      REDIS_PORT: +this.configService.getOrThrow('REDIS_PORT'),
      REDIS_USERNAME: this.configService.get('REDIS_USERNAME'),
      REDIS_PASSWORD: this.configService.get('REDIS_PASSWORD'),
      REDIS_TLS: this.configService.get('REDIS_TLS', 'false') === 'true',
      WORKER_IDLE_EXIT_SEC: +this.configService.get('WORKER_IDLE_EXIT_SEC', 0),
      BULL_DOWNLOAD_FILE_GENERATION_JOB_QUEUE: this.configService.getOrThrow('BULL_DOWNLOAD_FILE_GENERATION_JOB_QUEUE'),
    };
  }
}
