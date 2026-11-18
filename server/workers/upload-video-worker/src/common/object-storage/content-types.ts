import path from 'path';

// Set explicitly on every upload: browsers and HLS players need the right type, and a store would
// otherwise default to application/octet-stream (e.g. .m3u8 is in no standard mime table).
const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.vtt': 'text/vtt',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const PLAYLIST_EXTENSION = '.m3u8';

export const contentTypeForKey = (key: string): string =>
  CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
