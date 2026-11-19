// Bucket keys shared by every service. Internal working files, separate from the playback paths
// (Utils.getServer*Path in video-touch-common) that the CDN serves.

/** The asset's original video, written once by download-video-worker and read by every later step. */
export const getSourceObjectKey = (assetId: string): string => `sources/${assetId}/source.mp4`;

/** Folder of the asset's audio chunks (000.mp3, 001.mp3, …), written by audio extraction, read by transcription. */
export const getAudioChunksPrefix = (assetId: string): string => `audio/${assetId}/chunks/`;

export const getAudioChunkObjectKey = (assetId: string, chunkName: string): string =>
  `${getAudioChunksPrefix(assetId)}${chunkName}`;

/** One chunk's transcript (transcript_<n>.json), written by transcription, read by the transcript merge. */
export const getPartialTranscriptObjectKey = (assetId: string, transcriptName: string): string =>
  `audio/${assetId}/transcripts/${transcriptName}`;
