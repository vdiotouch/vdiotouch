import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@/src/common/app-config/environment';

@Injectable()
export class AppConfigService {
  public static appConfig: EnvironmentVariables;

  constructor(private configService: ConfigService<EnvironmentVariables>) {
    AppConfigService.appConfig = {
      VALIDATE_VIDEO_WORKER_PORT: +this.configService.getOrThrow('VALIDATE_VIDEO_WORKER_PORT'),
      RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE: this.configService.getOrThrow('RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE'),
      MAX_VIDEO_SIZE_IN_BYTES: +this.configService.get('MAX_VIDEO_SIZE_IN_BYTES', 5242880),
      RABBIT_MQ_URL: this.configService.getOrThrow('RABBIT_MQ_URL'),
      RABBIT_MQ_UPDATE_ASSET_STATUS_ROUTING_KEY: this.configService.getOrThrow(
        'RABBIT_MQ_UPDATE_ASSET_STATUS_ROUTING_KEY',
      ),
      RABBIT_MQ_UPDATE_ASSET_ROUTING_KEY: this.configService.getOrThrow('RABBIT_MQ_UPDATE_ASSET_ROUTING_KEY'),
      TEMP_VIDEO_DIRECTORY: this.configService.getOrThrow('TEMP_VIDEO_DIRECTORY'),
      BULL_VALIDATE_JOB_QUEUE: this.configService.getOrThrow('BULL_VALIDATE_JOB_QUEUE'),
      REDIS_HOST: this.configService.getOrThrow('REDIS_HOST'),
      REDIS_PORT: +this.configService.getOrThrow('REDIS_PORT'),
      REDIS_USERNAME: this.configService.get('REDIS_USERNAME'),
      REDIS_PASSWORD: this.configService.get('REDIS_PASSWORD'),
      REDIS_TLS: this.configService.get('REDIS_TLS', 'false') === 'true',
      WORKER_IDLE_EXIT_SEC: +this.configService.get('WORKER_IDLE_EXIT_SEC', 0),
      // Object storage (bucket shared by all services). Optional until a job uses it.
      STORAGE_PROVIDER: this.configService.get('STORAGE_PROVIDER'),
      AWS_ACCESS_KEY_ID: this.configService.get('AWS_ACCESS_KEY_ID'),
      AWS_SECRET_ACCESS_KEY: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      AWS_REGION: this.configService.get('AWS_REGION'),
      AWS_S3_BUCKET_NAME: this.configService.get('AWS_S3_BUCKET_NAME'),
      S3_ENDPOINT: this.configService.get('S3_ENDPOINT'),
      S3_FORCE_PATH_STYLE: this.configService.get('S3_FORCE_PATH_STYLE', 'false') === 'true',
      R2_ACCOUNT_ID: this.configService.get('R2_ACCOUNT_ID'),
      R2_ACCESS_KEY_ID: this.configService.get('R2_ACCESS_KEY_ID'),
      R2_SECRET_ACCESS_KEY: this.configService.get('R2_SECRET_ACCESS_KEY'),
      R2_BUCKET_NAME: this.configService.get('R2_BUCKET_NAME'),
      R2_ENDPOINT: this.configService.get('R2_ENDPOINT'),
    };
  }
}
