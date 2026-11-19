import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

async function bootstrap() {
  let app = await NestFactory.create(WorkerModule);
  // SIGTERM (platform stop or idle exit) lets the active job finish before the process exits.
  app.enableShutdownHooks();
  await app.listen(AppConfigService.appConfig.UPLOAD_VIDEO_WORKER_PORT);
}

bootstrap();
