import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { buildRedisConnection } from '@/src/common/app-config/build-redis-connection';
import { WorkerIdleExitService } from '@/src/common/idle-exit/worker-idle-exit.service';
import { AppConfigModule } from '@/src/common/app-config/app-config.module';
import { RabbitMQModule } from '@/src/common/rabbit-mq/rabbit-mq.module';
import { AwsModule } from '@/src/common/aws/aws.module';
import { VideoUploaderJobHandler } from '@/src/worker/upload-video.worker';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { BunnyModule } from '@/src/common/bunny/bunny.module';
import { R2Module } from '@/src/common/r2/r2.module';

@Module({
  imports: [
    DiscoveryModule,
    AppConfigModule,
    RabbitMQModule,
    AwsModule,
    BunnyModule,
    R2Module,
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: () => ({
        connection: buildRedisConnection(AppConfigService.appConfig),
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
