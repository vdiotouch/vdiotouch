import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthRateLimiter } from '@/src/api/auth/services/auth-rate-limiter.service';
import { normalizeEmail } from '@/src/api/auth/lib/normalize-email';
import {
  AUTH_RATE_LIMIT_PER_EMAIL,
  AUTH_RATE_LIMIT_PER_IP,
  AUTH_RATE_LIMIT_WINDOW_MS,
} from '@/src/api/auth/constants';

/**
 * Limits log in and sign up attempts per client IP and per email, so passwords can't be guessed
 * by brute force. Put it before LocalAuthGuard, so failed logins are counted too.
 * Answers 429 with a Retry-After header.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private limiter: AuthRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const route = req.path;

    const rules = [{ key: `${route}|ip:${req.ip}`, limit: AUTH_RATE_LIMIT_PER_IP }];
    const email = req.body?.email;
    if (typeof email === 'string' && email.trim()) {
      rules.push({ key: `${route}|email:${normalizeEmail(email)}`, limit: AUTH_RATE_LIMIT_PER_EMAIL });
    }

    const retryAfterSec = this.limiter.hit(rules, AUTH_RATE_LIMIT_WINDOW_MS);
    if (retryAfterSec > 0) {
      http.getResponse<Response>().setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException('Too many attempts. Try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
