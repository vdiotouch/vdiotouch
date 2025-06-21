import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/src/common/app-config/app-config.module';
import { ValidateVideoWorker } from '@/src/worker/validate-video.worker';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { RabbitMQModule } from '../common/rabbit-mq/rabbit-mq.module';


@Module({
  imports: [
    AppConfigModule,
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: () => ({
        connection: {
          host: AppConfigService.appConfig.REDIS_HOST,
          port: AppConfigService.appConfig.REDIS_PORT,
        },
      }),
    }),
    BullModule.registerQueueAsync({
      inject: [AppConfigService],
      useFactory: () => ({
        name: AppConfigService.appConfig.BULL_VALIDATE_JOB_QUEUE,
      }),
    }),
    RabbitMQModule
  ],
  controllers: [],
  providers: [ValidateVideoWorker],
})
export class WorkerModule {}
