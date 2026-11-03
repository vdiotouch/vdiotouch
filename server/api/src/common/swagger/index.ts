import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { adminBasicAuth, hasAdminCredentials } from '@/src/common/middlewares/admin-basic-auth.middleware';

export async function setupSwagger(app: INestApplication, port: number) {
  let swaggerDocPath = '/api-doc';
  if (!hasAdminCredentials()) {
    Logger.warn('SWAGGER_USERNAME or SWAGGER_PASSWORD is not set, so Swagger is turned off', 'Swagger');
    return;
  }

  const config = new DocumentBuilder()
    .setTitle(AppConfigService.appConfig.SWAGGER_TITLE)
    .setDescription(AppConfigService.appConfig.SWAGGER_DESCRIPTION)
    .setVersion(AppConfigService.appConfig.SWAGGER_VERSION)
    .addApiKey(
      { type: 'apiKey', name: 'Authorization', in: 'header', scheme: 'bearer', bearerFormat: 'Bearer' },
      'auth'
    )
    .addServer(
      AppConfigService.appConfig.SWAGGER_SERVER_BASE_URL,
      AppConfigService.appConfig.SWAGGER_SERVER_BASE_URL_DESCRIPTION
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use([swaggerDocPath, swaggerDocPath + '-json'], adminBasicAuth);

  SwaggerModule.setup(swaggerDocPath, app, document, {
    swaggerOptions: { persistAuthorization: true, ignoreGlobalPrefix: true },
  });
}
