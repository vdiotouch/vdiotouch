import { NestFactory } from '@nestjs/core';
import { ApiModule } from './api/api.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import morgan from 'morgan';
import { setupSwagger } from '@/src/common/swagger';
import { HttpExceptionFilter } from '@/src/common/filters/http-exception.filter';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule);
  const { CORS_ORIGINS, TRUST_PROXY } = AppConfigService.appConfig;
  // req.ip must be the real client IP, because log in attempts are limited per IP.
  app.set('trust proxy', TRUST_PROXY);
  // CSP is off: the api only serves JSON, and Swagger, GraphiQL and the queue dashboard use inline scripts.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    credentials: true,
    origin: CORS_ORIGINS,
  });
  let PORT = +process.env.API_PORT || 3000;
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  await setupSwagger(app, PORT);
  app.useGlobalFilters(new HttpExceptionFilter());

  morgan.token('remote-addr', (req, res) => {
    let remoteAddr = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    return remoteAddr.toString();
  });

  app.use(morgan(':remote-addr :method :url :status :res[content-length] - :response-time ms'));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  await app.listen(PORT);

  Logger.log(await app.getUrl(), 'App URL');
}

bootstrap();
