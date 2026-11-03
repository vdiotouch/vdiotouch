/** Statuses the encoding pipeline reports, in the order a video goes through them. */
export const ASSET_STATUS = {
  QUEUED: "QUEUED",
  DOWNLOADING: "DOWNLOADING",
  DOWNLOADED: "DOWNLOADED",
  VALIDATED: "VALIDATED",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;

export const FILE_TYPE = {
  PLAYLIST: "playlist",
  THUMBNAIL: "thumbnail",
  SOURCE: "source",
  DOWNLOAD: "download",
  AUDIO: "audio",
  TRANSCRIPT: "transcript",
} as const;

/** Downloadable files on the Files tab, in display order. */
export const DOWNLOADABLE_FILES = [
  { type: FILE_TYPE.SOURCE, label: "Source" },
  { type: FILE_TYPE.DOWNLOAD, label: "MP4 download" },
  { type: FILE_TYPE.THUMBNAIL, label: "Thumbnail" },
  { type: FILE_TYPE.AUDIO, label: "Audio" },
  { type: FILE_TYPE.TRANSCRIPT, label: "Transcript" },
] as const;

/** Formats the import dialog lists; the api decides what it really accepts. */
export const SUPPORTED_FORMATS = "MP4, MOV, MKV or WebM";
