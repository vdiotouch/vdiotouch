import { Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import { Constants, Utils } from 'video-touch-common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';

// HLS BANDWIDTH per rendition height, same values the process-video-worker used to append.
const BANDWIDTH_BY_HEIGHT: Record<number, number> = {
  360: 375000,
  480: 750000,
  540: 1000000,
  720: 2000000,
  1080: 3500000,
};

/**
 * Writes an asset's master playlist (videos/<id>/main.m3u8) from its READY playlist files.
 * Replaces the workers appending to a shared main.m3u8 on disk: each transcoder now runs alone,
 * so the api, which knows every rendition's status, owns the master.
 */
@Injectable()
export class MasterManifestService {
  // One write at a time per asset, so a slower, older write can't overwrite a newer, longer playlist.
  private pendingWrites = new Map<string, Promise<void>>();

  constructor(private fileRepository: FileRepository, private objectStorageService: ObjectStorageService) {}

  /** Rewrites the master playlist. Each call re-reads the files, so the last write always lists every READY rendition. */
  rebuild(assetId: string): Promise<void> {
    const previous = this.pendingWrites.get(assetId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.write(assetId))
      .finally(() => {
        if (this.pendingWrites.get(assetId) === next) {
          this.pendingWrites.delete(assetId);
        }
      });
    this.pendingWrites.set(assetId, next);
    return next;
  }

  private async write(assetId: string) {
    const readyPlaylists = await this.fileRepository.find({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: Constants.FILE_TYPE.PLAYLIST,
      latest_status: Constants.FILE_STATUS.READY,
    });
    const heights = readyPlaylists.map((file) => file.height).sort((a, b) => b - a);
    const content = this.buildContent(heights);
    await this.objectStorageService.uploadStream(Utils.getServerManifestPath(assetId), Readable.from([content]));
    console.log(`master playlist written for asset ${assetId} with renditions`, heights);
  }

  private buildContent(heights: number[]): string {
    const resolutions = Constants.VIDEO_RESOLUTION as Record<string, { height: number; width: number }>;
    const lines = ['#EXTM3U'];
    for (const height of heights) {
      const { width } = resolutions[`${height}p`];
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${BANDWIDTH_BY_HEIGHT[height]},RESOLUTION=${width}x${height}`);
      lines.push(`${height}/${Utils.getFileName(height)}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
