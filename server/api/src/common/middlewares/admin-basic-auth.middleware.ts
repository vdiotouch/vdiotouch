import { NextFunction, Request, RequestHandler, Response } from 'express';
import basicAuth from 'express-basic-auth';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

/** True when SWAGGER_USERNAME and SWAGGER_PASSWORD are both set. */
export function hasAdminCredentials(): boolean {
  const { SWAGGER_USERNAME, SWAGGER_PASSWORD } = AppConfigService.appConfig;
  return !!SWAGGER_USERNAME && !!SWAGGER_PASSWORD;
}

let handler: RequestHandler | null = null;

/**
 * Basic auth for admin pages (Swagger, the queue dashboard), using SWAGGER_USERNAME / SWAGGER_PASSWORD.
 * Without both set, the pages answer 404. Built on the first request, because modules are
 * declared before the config is loaded.
 */
export function adminBasicAuth(req: Request, res: Response, next: NextFunction) {
  if (!hasAdminCredentials()) {
    res.status(404).end();
    return;
  }
  if (!handler) {
    const { SWAGGER_USERNAME, SWAGGER_PASSWORD } = AppConfigService.appConfig;
    handler = basicAuth({ challenge: true, users: { [SWAGGER_USERNAME]: SWAGGER_PASSWORD } });
  }
  handler(req, res, next);
}
