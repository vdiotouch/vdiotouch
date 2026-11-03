import { DOWNLOADABLE_FILES, FILE_TYPE } from "../constants";
import type { FileDetails } from "../types";

/** One HLS playlist per resolution, highest first. */
export function resolutionFiles(files: FileDetails[]) {
  return files
    .filter((file) => file.type === FILE_TYPE.PLAYLIST)
    .sort((a, b) => b.height - a.height);
}

/** Source, MP4, thumbnail, audio and transcript files that exist for this video. */
export function downloadableFiles(files: FileDetails[]) {
  return DOWNLOADABLE_FILES.flatMap(({ type, label }) => {
    const file = files.find((f) => f.type === type);
    return file ? [{ file, label }] : [];
  });
}

/** "720p" */
export function resolutionLabel(file: Pick<FileDetails, "height">) {
  return `${file.height}p`;
}

/**
 * URL of one resolution's playlist. The api writes each one next to the
 * master playlist as `<height>/<file name>` (rendition.service.ts), and
 * GetFileUrl has no case for playlists, so the URL is built here.
 */
export function resolutionUrl(masterPlaylistUrl: string, file: FileDetails) {
  return new URL(`${file.height}/${file.name}`, masterPlaylistUrl).href;
}
