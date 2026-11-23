export interface EnvironmentVariables {
  AUDIO_WORKER_PORT: number;
  RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE: string;
  RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY: string;
  RABBIT_MQ_URL: string;
  TEMP_VIDEO_DIRECTORY: string;
  BULL_AUDIO_EXTRACTION_JOB_QUEUE: string;
  BULL_AUDIO_TRANSCRIPTION_JOB_QUEUE: string;
  BULL_AUDIO_SPLIT_JOB_QUEUE: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  // Optional, for managed Redis. Empty locally.
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_TLS: boolean;
  // BullMQ key prefix. Use "{bull}" on a Redis Cluster (keeps each queue's keys on one shard). Same in every service.
  BULL_PREFIX: string;
  // Seconds without an active job before the process exits. Empty or 0 = never (docker-compose).
  WORKER_IDLE_EXIT_SEC: number;
  TRANSCRIPTION_GENERATION_ENABLED: boolean;
  // Length of each audio chunk sent for transcription. Must equal the api's value: it computes chunk start times.
  AUDIO_CHUNK_DURATION_IN_SEC: number;
  GOOGLE_GEN_AI_MODEL: string;
  GOOGLE_GENAI_API_KEY: string;
  GOOGLE_GENAI_TEMPERATURE: number;
  GOOGLE_GENAI_THINKING_LEVEL: string;
  OPENAI_MODEL: string;
  OPENAI_API_KEY: string;
  BULL_AUDIO_TRANSCRIPT_MERGE_QUEUE: string;
  TRANSCRIPT_PROMT_FILE_URL: string;
  GEN_AI_AUDIO_TRANSCRIPTION_PROVIDER: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_ENDPOINT: string;
  AZURE_OPENAI_DEPLOYMENT: string;
  AZURE_OPENAI_API_VERSION: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_AI_MODEL: string;
  // Object storage (bucket shared by all services): s3 or r2. Every job reads and writes it.
  STORAGE_PROVIDER?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET_NAME?: string;
  // Optional, STORAGE_PROVIDER=s3 only: another S3-compatible store (e.g. GCS interop). Empty = AWS.
  S3_ENDPOINT?: string;
  S3_FORCE_PATH_STYLE: boolean;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  // Optional. Defaults to https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_ENDPOINT?: string;
}
