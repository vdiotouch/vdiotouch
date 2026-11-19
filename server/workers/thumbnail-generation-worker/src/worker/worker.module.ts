import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { buildRedisConnection } from '@/src/common/app-config/build-redis-connection';
import { WorkerIdleExitService } from '@/src/common/idle-exit/worker-idle-exit.service';
import { AppConfigModule } from '@/src/common/app-config/app-config.module';
import { RabbitMQModule } from '@/src/common/rabbit-mq/rabbit-mq.module';
import { ThumbnailGenerationWorker } from '@/src/worker/thumbnail-generation.worker';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { ObjectStorageModule } from '@/src/common/object-storage/object-storage.module';

@Module({
  imports: [
    DiscoveryModule,
    AppConfigModule,
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: () => ({
        connection: buildRedisConnection(AppConfigService.appConfig),
      }),
    }),
    BullModule.registerQueueAsync({
      name: 'thumbnail-generation',
      inject: [AppConfigService],
      useFactory: () => ({
        name: AppConfigService.appConfig.BULL_THUMBNAIL_GENERATION_JOB_QUEUE,
      }),
    }),
    RabbitMQModule,
    ObjectStorageModule,
  ],
  controllers: [],
  providers: [ThumbnailGenerationWorker, WorkerIdleExitService],
})
export class WorkerModule {}
