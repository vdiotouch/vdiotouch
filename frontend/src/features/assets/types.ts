import type { CursorPage } from "@/shared/lib/use-cursor-pagination";

/** One row of the videos list. */
export interface AssetSummary {
  _id: string;
  title: string;
  thumbnail_url: string;
  latest_status: string;
  duration: number;
  size: number;
  tags: string[];
  created_at: string;
}

export interface AssetList {
  ListAsset: { assets: AssetSummary[]; page_info: CursorPage };
}

export interface FileDetails {
  _id: string;
  name: string;
  size: number;
  latest_status: string;
  height: number;
  width: number;
  /** "playlist" (one per resolution), "thumbnail", "source", "download", "audio" or "transcript". */
  type: string;
}

export interface StatusLog {
  status: string;
  details: string;
  created_at: string;
}

export interface AssetDetails {
  _id: string;
  title: string;
  height: number;
  width: number;
  duration: number;
  description: string | null;
  status_logs: StatusLog[];
  size: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  thumbnail_url: string;
  latest_status: string;
  master_playlist_url: string | null;
  files: FileDetails[];
  with_transcription: boolean;
  with_transcoding: boolean;
}

/** The fields the details form edits. */
export interface AssetEditableFields {
  title: string;
  description: string;
  tags: string[];
}

export interface CreateAssetInput {
  source_url: string;
  title?: string;
  with_transcoding: boolean;
  with_transcription: boolean;
}
