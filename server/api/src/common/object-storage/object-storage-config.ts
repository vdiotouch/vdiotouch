import { S3ClientConfig } from '@aws-sdk/client-s3';
import { Constants } from 'video-touch-common';
import { EnvironmentVariables } from '@/src/common/app-config/environment';

type StorageConfig = Pick<
  EnvironmentVariables,
  | 'STORAGE_PROVIDER'
  | 'AWS_ACCESS_KEY_ID'
  | 'AWS_SECRET_ACCESS_KEY'
  | 'AWS_REGION'
  | 'AWS_S3_BUCKET_NAME'
  | 'S3_ENDPOINT'
  | 'S3_FORCE_PATH_STYLE'
  | 'R2_ACCOUNT_ID'
  | 'R2_ACCESS_KEY_ID'
  | 'R2_SECRET_ACCESS_KEY'
  | 'R2_BUCKET_NAME'
  | 'R2_ENDPOINT'
>;

export interface ObjectStorageConfig {
  bucket: string;
  clientConfig: S3ClientConfig;
}

/**
 * S3 API settings for the configured STORAGE_PROVIDER, or null when the provider has no S3 API (bunny).
 *   r2: R2_* keys, endpoint R2_ENDPOINT or https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
 *   s3: AWS_* keys; S3_ENDPOINT / S3_FORCE_PATH_STYLE for other S3-compatible stores (e.g. GCS interop)
 */
export const resolveObjectStorageConfig = (config: StorageConfig): ObjectStorageConfig | null => {
  switch (config.STORAGE_PROVIDER) {
    case Constants.STORAGE_PROVIDER.R2:
      return {
        bucket: config.R2_BUCKET_NAME,
        clientConfig: {
          region: 'auto',
          endpoint: config.R2_ENDPOINT || `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY },
        },
      };
    case Constants.STORAGE_PROVIDER.S3:
      return {
        bucket: config.AWS_S3_BUCKET_NAME,
        clientConfig: {
          region: config.AWS_REGION,
          credentials: { accessKeyId: config.AWS_ACCESS_KEY_ID, secretAccessKey: config.AWS_SECRET_ACCESS_KEY },
          ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT, forcePathStyle: config.S3_FORCE_PATH_STYLE } : {}),
        },
      };
    default:
      return null;
  }
};
