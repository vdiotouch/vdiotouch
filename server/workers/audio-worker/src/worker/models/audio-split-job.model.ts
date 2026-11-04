/**
 * Payload for the audio-split job the API publishes to BULL_AUDIO_SPLIT_JOB_QUEUE.
 *
 * Mirrors src/api/assets/models/audio-split-job.model.ts in the API. Deliberately not in
 * video-touch-common: the package versions have already drifted across the workers, and a shared
 * bump would force a coordinated release of all eight images for one interface. This worker
 * already carries its own copy of file-status.publisher.ts for the same reason.
 */
export interface AudioSplitJobModel {
  asset_id: string;
  /** The TRANSCRIPT file — the status handle for the whole run. */
  file_id: string;
  /** CDN url of the asset's audio.mp3. Fallback for when the local copy has been cleaned up. */
  audio_url: string;
  /** This worker has no AUDIO_CHUNK_DURATION_IN_SEC of its own, so it travels with the job. */
  chunk_duration_in_sec: number;
}
