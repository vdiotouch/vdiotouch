import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@/src/common/app-config/environment';

@Injectable()
export class AppConfigService {
  public static appConfig: EnvironmentVariables;

  constructor(private configService: ConfigService<EnvironmentVariables>) {
    AppConfigService.appConfig = {
      AUDIO_WORKER_PORT: +this.configService.getOrThrow('AUDIO_WORKER_PORT'),
      RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE: this.configService.getOrThrow('RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE'),
      RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY: this.configService.getOrThrow(
        'RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY',
      ),
      RABBIT_MQ_URL: this.configService.getOrThrow('RABBIT_MQ_URL'),
      TEMP_VIDEO_DIRECTORY: this.configService.getOrThrow('TEMP_VIDEO_DIRECTORY'),
      BULL_AUDIO_EXTRACTION_JOB_QUEUE: this.configService.getOrThrow('BULL_AUDIO_EXTRACTION_JOB_QUEUE'),
      REDIS_HOST: this.configService.getOrThrow('REDIS_HOST'),
      REDIS_PORT: +this.configService.getOrThrow('REDIS_PORT'),
      REDIS_USERNAME: this.configService.get('REDIS_USERNAME'),
      REDIS_PASSWORD: this.configService.get('REDIS_PASSWORD'),
      REDIS_TLS: this.configService.get('REDIS_TLS', 'false') === 'true',
      WORKER_IDLE_EXIT_SEC: +this.configService.get('WORKER_IDLE_EXIT_SEC', 0),
      BULL_UPLOAD_JOB_QUEUE: this.configService.getOrThrow('BULL_UPLOAD_JOB_QUEUE'),
      BULL_AUDIO_TRANSCRIPTION_JOB_QUEUE: this.configService.getOrThrow('BULL_AUDIO_TRANSCRIPTION_JOB_QUEUE'),
      TRANSCRIPTION_GENERATION_ENABLED: this.configService.get('TRANSCRIPTION_GENERATION_ENABLED') === 'true',
      GOOGLE_GENAI_API_KEY: this.configService.get('GOOGLE_GENAI_API_KEY'),
      OPENAI_API_KEY: this.configService.get('OPENAI_API_KEY'),
      GOOGLE_GEN_AI_MODEL: this.configService.get('GOOGLE_GEN_AI_MODEL'),
      GOOGLE_GENAI_TEMPERATURE: +this.configService.get('GOOGLE_GENAI_TEMPERATURE'),
      GOOGLE_GENAI_THINKING_LEVEL: this.configService.get('GOOGLE_GENAI_THINKING_LEVEL'),
      OPENAI_MODEL: this.configService.get('OPENAI_MODEL'),
      BULL_AUDIO_SPLIT_JOB_QUEUE: this.configService.getOrThrow('BULL_AUDIO_SPLIT_JOB_QUEUE'),
      BULL_AUDIO_TRANSCRIPT_MERGE_QUEUE: this.configService.getOrThrow('BULL_AUDIO_TRANSCRIPT_MERGE_QUEUE'),
      TRANSCRIPT_PROMT_FILE_URL: this.configService.getOrThrow('TRANSCRIPT_PROMT_FILE_URL'),
      GEN_AI_AUDIO_TRANSCRIPTION_PROVIDER: this.configService.get('GEN_AI_AUDIO_TRANSCRIPTION_PROVIDER'),
      AZURE_OPENAI_API_KEY: this.configService.get('AZURE_OPENAI_API_KEY'),
      AZURE_OPENAI_ENDPOINT: this.configService.get('AZURE_OPENAI_ENDPOINT'),
      AZURE_OPENAI_DEPLOYMENT: this.configService.get('AZURE_OPENAI_DEPLOYMENT'),
      AZURE_OPENAI_API_VERSION: this.configService.get('AZURE_OPENAI_API_VERSION'),
      CLOUDFLARE_ACCOUNT_ID: this.configService.get('CLOUDFLARE_ACCOUNT_ID'),
      CLOUDFLARE_API_TOKEN: this.configService.get('CLOUDFLARE_API_TOKEN'),
      CLOUDFLARE_AI_MODEL: this.configService.get('CLOUDFLARE_AI_MODEL'),
    };
  }
}
