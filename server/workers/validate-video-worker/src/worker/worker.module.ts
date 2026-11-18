import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { buildRedisConnection } from '@/src/common/app-config/build-redis-connection';
import { WorkerIdleExitService } from '@/src/common/idle-exit/worker-idle-exit.service';
import { AppConfigModule } from '@/src/common/app-config/app-config.module';
import { ValidateVideoWorker } from '@/src/worker/validate-video.worker';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { RabbitMQModule } from '../common/rabbit-mq/rabbit-mq.module';

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
      inject: [AppConfigService],
      useFactory: () => ({
        name: AppConfigService.appConfig.BULL_VALIDATE_JOB_QUEUE,
      }),
    }),
    RabbitMQModule,
  ],
  controllers: [],
  providers: [ValidateVideoWorker, WorkerIdleExitService],
})
export class WorkerModule {}
