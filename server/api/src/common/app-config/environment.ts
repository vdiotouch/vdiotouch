export interface EnvironmentVariables {
  API_PORT: number;
  APP_NAME: string;

  SWAGGER_TITLE: string;
  SWAGGER_DESCRIPTION: string;
  SWAGGER_VERSION: string;
  SWAGGER_SERVER_BASE_URL: string;
  SWAGGER_SERVER_BASE_URL_DESCRIPTION: string;

  SWAGGER_USERNAME: string;
  SWAGGER_PASSWORD: string;
  DB_DRIVER: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_MIGRATE: string;

  RABBIT_MQ_URL: string;
  RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE: string;
  RABBIT_MQ_UPDATE_ASSET_STATUS_ROUTING_KEY: string;
  RABBIT_MQ_UPDATE_ASSET_STATUS_QUEUE: string;
  RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY: string;
  RABBIT_MQ_UPDATE_FILE_STATUS_QUEUE: string;
  RABBIT_MQ_UPDATE_ASSET_ROUTING_KEY: string;
  RABBIT_MQ_UPDATE_ASSET_QUEUE: string;
  MAX_VIDEO_SIZE_IN_BYTES: number;

  BULL_VALIDATE_JOB_QUEUE: string;
  BULL_DOWNLOAD_JOB_QUEUE: string;
  BULL_UPLOAD_JOB_QUEUE: string;
  BULL_360P_PROCESS_VIDEO_JOB_QUEUE: string;
  BULL_480P_PROCESS_VIDEO_JOB_QUEUE: string;
  BULL_540P_PROCESS_VIDEO_JOB_QUEUE: string;
  BULL_720P_PROCESS_VIDEO_JOB_QUEUE: string;
  BULL_1080P_PROCESS_VIDEO_JOB_QUEUE: string;
  // Rendition ladder, e.g. "720,540,480". Each height needs its BULL_<H>P_PROCESS_VIDEO_JOB_QUEUE and a worker.
  TRANSCODE_HEIGHTS: number[];
  BULL_THUMBNAIL_GENERATION_JOB_QUEUE: string;
  BULL_DOWNLOAD_FILE_GENERATION_JOB_QUEUE: string;
  BULL_AUDIO_EXTRACTION_JOB_QUEUE: string;
  BULL_AUDIO_TRANSCRIPTION_JOB_QUEUE: string;
  BULL_AUDIO_TRANSCRIPT_MERGE_QUEUE: string;

  AWS_ACCESS_KEY_ID: string;
  AWS_REGION: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_S3_BUCKET_NAME: string;
  // Optional, STORAGE_PROVIDER=s3 only: another S3-compatible store (e.g. GCS interop). Empty = AWS.
  S3_ENDPOINT?: string;
  S3_FORCE_PATH_STYLE: boolean;
  VIDEO_BASE_URL: string;

  CDN_PROVIDER: string;

  DEFAULT_THUMBNAIL_URL: string;
  JWT_EXPIRATION_TIME_IN_SEC: number;
  JWT_SECRET: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  // Optional, for managed Redis. Empty locally.
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS: boolean;
  RETRY_JOB_ATTEMPT_COUNT: number;
  RETRY_JOB_BACKOFF_IN_MINUTE: number;
  TRANSCRIPTION_GENERATION_ENABLED: boolean;

  GOOGLE_GENAI_API_KEY: string;
  GOOGLE_GEN_AI_MODEL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  AUDIO_CHUNK_DURATION_IN_SEC: number;
  // s3 | r2. Every service shares files through this bucket.
  STORAGE_PROVIDER: string;

  // Still read by the Bunny CDN config check (CDN_PROVIDER=bunny).
  BUNNY_STORAGE_ZONE_NAME: string;
  BUNNY_STORAGE_URL: string;

  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  // Optional. Defaults to https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_ENDPOINT: string;

  RABBIT_MQ_WEBHOOK_NOTIFY_CONSUMER_QUEUE: string;

  RABBIT_MQ_WEBHOOK_NOTIFY_ROUTING_KEY: string;

  GOTIPATH_CDN_SECRET: string;
  GOTIPATH_API_BASE_URL: string;
  GOTIPATH_API_KEY: string;
  GOTIPATH_CDN_DISTRIBUTION_ID: string;
  GOTIPATH_CDN_BASE_URL: string;

  BUNNY_CDN_PULL_ZONE_ID: string;
  BUNNY_CDN_API_KEY: string;
  BUNNY_CDN_API_BASE_URL: string;
  BUNNY_CDN_BASE_URL: string;

  CLOUDFLARE_CDN_ZONE_ID: string;
  CLOUDFLARE_CDN_API_TOKEN: string;
  // Optional host only (no API version). Defaults to https://api.cloudflare.com
  CLOUDFLARE_CDN_API_BASE_URL: string;
  CLOUDFLARE_CDN_BASE_URL: string;

  SLA_ALERTS_ENABLED: boolean;
  SLA_TARGET_MINUTES: number;
  SLA_WARNING_THRESHOLD_MINUTES: number;
  SLA_LOOKBACK_HOURS: number;
  SLA_CHECK_BATCH_LIMIT: number;
  SLA_DIGEST_THRESHOLD: number;
  SLA_MAX_DELIVERY_ATTEMPTS: number;
  SLA_SLACK_WEBHOOK_URL?: string;
  INTERNAL_API_KEY?: string;

  // Optional push to an autoscaler after every job add. Empty = autoscalers only poll the backlog endpoint.
  SCALE_WEBHOOK_URL?: string;
  SCALE_WEBHOOK_TOKEN?: string;

  // Max worker replicas per pool, reported by GET /api/v1/processors/backlog.
  DOWNLOAD_MAX_PROCESSORS: number;
  VALIDATE_MAX_PROCESSORS: number;
  THUMBNAIL_MAX_PROCESSORS: number;
  TRANSCODE_1080P_MAX_PROCESSORS: number;
  TRANSCODE_720P_MAX_PROCESSORS: number;
  TRANSCODE_540P_MAX_PROCESSORS: number;
  TRANSCODE_480P_MAX_PROCESSORS: number;
  TRANSCODE_360P_MAX_PROCESSORS: number;
  MP4_MAX_PROCESSORS: number;
  UPLOAD_MAX_PROCESSORS: number;
  AUDIO_MAX_PROCESSORS: number;
}
