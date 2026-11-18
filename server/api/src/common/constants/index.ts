export const WEBHOOOK_RESPONSE_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

export const WEBHOOK_IDENTIFICATION_TYPES = {
  ASSET: 'asset',
  FILE: 'file',
};

// Worker pools an autoscaler can size (see GET /api/v1/processors/backlog). One pool = one worker deployment.
export const PROCESSOR_POOLS = {
  DOWNLOAD: 'download',
  VALIDATE: 'validate',
  THUMBNAIL: 'thumbnail',
  TRANSCODE_1080P: 'transcode-1080p',
  TRANSCODE_720P: 'transcode-720p',
  TRANSCODE_540P: 'transcode-540p',
  TRANSCODE_480P: 'transcode-480p',
  TRANSCODE_360P: 'transcode-360p',
  MP4: 'mp4',
  UPLOAD: 'upload',
  AUDIO: 'audio',
};

export const CDN_PROVIDERS = {
  GOTIPATH: 'gotipath',
  CLOUDFRONT: 'cloudfront',
  BUNNY_CDN: 'bunny',
  CLOUDFLARE: 'cloudflare',
};
