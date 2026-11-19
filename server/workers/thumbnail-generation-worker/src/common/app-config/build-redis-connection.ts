import { ConnectionOptions } from 'bullmq';
import { EnvironmentVariables } from '@/src/common/app-config/environment';

type RedisConfig = Pick<
  EnvironmentVariables,
  'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_USERNAME' | 'REDIS_PASSWORD' | 'REDIS_TLS'
>;

/** BullMQ connection. Username, password and TLS are only set when configured (managed Redis). */
export const buildRedisConnection = (config: RedisConfig): ConnectionOptions => ({
  host: config.REDIS_HOST,
  port: +config.REDIS_PORT,
  ...(config.REDIS_USERNAME ? { username: config.REDIS_USERNAME } : {}),
  ...(config.REDIS_PASSWORD ? { password: config.REDIS_PASSWORD } : {}),
  ...(config.REDIS_TLS ? { tls: {} } : {}),
});
