import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { buildRedisConnection } from '@/src/common/app-config/build-redis-connection';
import { WorkerIdleExitService } from '@/src/common/idle-exit/worker-idle-exit.service';
import { AppConfigModule } from '@/src/common/app-config/app-config.module';
import { AudioExtractionService } from '@/src/worker/audio-extraction.service';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { RabbitMQModule } from '../common/rabbit-mq/rabbit-mq.module';
import { FileStatusPublisher } from '@/src/worker/file-status.publisher';
import { ObjectStorageModule } from '@/src/common/object-storage/object-storage.module';
import { AudioExtractionWorker } from '@/src/worker/audio-extraction.worker';
import { AudioTranscriptionWorker } from '@/src/worker/audio-transcription.worker';
import { GenAiClientModule } from '@/src/common/gen-ai-models/gen-ai-client.module';
import { TranscriptMergerWorker } from '@/src/worker/transcript-merger.worker';
import { AudioStorageService } from '@/src/worker/audio-storage.service';

@Module({
  imports: [
    DiscoveryModule,
    AppConfigModule,
    RabbitMQModule,
    ObjectStorageModule,
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: () => ({
        connection: buildRedisConnection(AppConfigService.appConfig),
        prefix: AppConfigService.appConfig.BULL_PREFIX,
      }),
    }),
    BullModule.registerQueueAsync(
      {
        inject: [AppConfigService],
        useFactory: () => ({
          name: AppConfigService.appConfig.BULL_AUDIO_EXTRACTION_JOB_QUEUE,
        }),
      },
      {
        inject: [AppConfigService],
        useFactory: () => ({
          name: AppConfigService.appConfig.BULL_AUDIO_TRANSCRIPTION_JOB_QUEUE,
        }),
      },
    ),
    GenAiClientModule,
  ],
  controllers: [],
  providers: [
    WorkerIdleExitService,
    AudioExtractionService,
    AudioStorageService,
    AudioExtractionWorker,
    AudioTranscriptionWorker,
    FileStatusPublisher,
    TranscriptMergerWorker,
  ],
})
export class WorkerModule {}
