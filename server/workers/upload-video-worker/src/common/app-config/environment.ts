export interface EnvironmentVariables {
  UPLOAD_VIDEO_WORKER_PORT: number;
  RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE: string;
  RABBIT_MQ_URL: string;
  AWS_S3_BUCKET_NAME: string;
  // Optional, STORAGE_PROVIDER=s3 only: another S3-compatible store (e.g. GCS interop). Empty = AWS.
  S3_ENDPOINT?: string;
  S3_FORCE_PATH_STYLE: boolean;
  AWS_REGION: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_ACCESS_KEY_ID: string;
  RABBIT_MQ_UPDATE_FILE_STATUS_QUEUE: string;
  RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY: string;
  BULL_UPLOAD_JOB_QUEUE: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  // Optional, for managed Redis. Empty locally.
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS: boolean;
  // Seconds without an active job before the process exits. Empty or 0 = never (docker-compose).
  WORKER_IDLE_EXIT_SEC: number;
  // s3 | r2. Both go through ObjectStorageService (S3 API).
  STORAGE_PROVIDER: string;

  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  // Optional. Defaults to https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_ENDPOINT: string;
}
