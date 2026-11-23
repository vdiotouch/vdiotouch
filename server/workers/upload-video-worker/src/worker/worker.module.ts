import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { buildRedisConnection } from '@/src/common/app-config/build-redis-connection';
import { WorkerIdleExitService } from '@/src/common/idle-exit/worker-idle-exit.service';
import { AppConfigModule } from '@/src/common/app-config/app-config.module';
import { RabbitMQModule } from '@/src/common/rabbit-mq/rabbit-mq.module';
import { VideoUploaderJobHandler } from '@/src/worker/upload-video.worker';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { ObjectStorageModule } from '@/src/common/object-storage/object-storage.module';

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
    BullModule.registerQueueAsync({
      inject: [AppConfigService],
      useFactory: () => ({
        name: AppConfigService.appConfig.BULL_UPLOAD_JOB_QUEUE,
      }),
    }),
  ],
  controllers: [],
  providers: [VideoUploaderJobHandler, WorkerIdleExitService],
})
export class WorkerModule {}
