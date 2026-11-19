// Bucket keys shared by every service. Internal working files, separate from the playback paths
// (Utils.getServer*Path in video-touch-common) that the CDN serves.

/** The asset's original video, written once by download-video-worker and read by every later step. */
export const getSourceObjectKey = (assetId: string): string => `sources/${assetId}/source.mp4`;
