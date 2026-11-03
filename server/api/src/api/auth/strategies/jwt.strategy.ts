import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '@/src/api/auth/services/user.service';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { TokenPayload } from '@/src/api/auth/services/auth.service';
import { JWT_ALGORITHM } from '@/src/api/auth/constants';

/**
 * `iat` is in whole seconds, so it's compared with the change time rounded down to the second:
 * a token issued in the same second as the change, such as the log in right after it, still works.
 */
function isIssuedBeforePasswordChange(issuedAtSec: number | undefined, passwordChangedAt?: Date): boolean {
  if (!passwordChangedAt) {
    return false;
  }
  if (typeof issuedAtSec !== 'number') {
    return true;
  }
  return issuedAtSec < Math.floor(new Date(passwordChangedAt).getTime() / 1000);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: AppConfigService.appConfig.JWT_SECRET,
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate({ user_id, iat }: TokenPayload & { iat?: number }) {
    let user = await this.userService.getUserById(user_id);
    if (!user) {
      return null;
    }
    if (isIssuedBeforePasswordChange(iat, user.password_changed_at)) {
      return null;
    }
    delete user.password;
    return user;
  }
}
