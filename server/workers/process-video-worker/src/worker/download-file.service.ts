import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { Utils } from 'video-touch-common';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import { TranscodingService } from '@/src/worker/transcoding.service';

/**
 * Builds the downloadable MP4 from a rendition and uploads it straight to its playback path (videos/<id>/<name>),
 * so the mp4 step needs no upload-video-worker and no shared disk. Only used when object storage is enabled.
 */
@Injectable()
export class DownloadFileService {
  constructor(
    private objectStorageService: ObjectStorageService,
    private transcodingService: TranscodingService,
  ) {}

  isEnabled(): boolean {
    return this.objectStorageService.isEnabled();
  }

  /** Returns the MP4's size in bytes, reported on the file's READY event (as upload-video-worker did). */
  async createAndUploadMp4(assetId: string, height: number, name: string): Promise<number> {
    await this.ensureLocalRendition(assetId, height);

    let res = await this.transcodingService.createMp4FromM3u8ByResolution(assetId, height, name);
    console.log(`video ${height}p download:`, res);

    let localFilePath = this.transcodingService.getLocalDownloadFilePath(assetId, name);
    let key = Utils.getServerDownloadFilePath(assetId, name);
    await this.objectStorageService.uploadFile(key, localFilePath);
    console.log(`download file ${height}p uploaded for asset ${assetId}: ${key}`);

    const stats = await fs.promises.stat(localFilePath);
    return stats.size;
  }

  /**
   * A container on its own has no shared disk, so fetch the rendition the transcoder already put in the bucket.
   * On docker-compose (shared disk) the local copy is there and is used as is.
   */
  private async ensureLocalRendition(assetId: string, height: number) {
    let playlistPath = this.transcodingService.getLocalPlaylistPath(assetId, height);
    if (fs.existsSync(playlistPath)) {
      return;
    }
    let prefix = `${Utils.getBunnyUriVideoPathByHeight(assetId, height)}/`;
    let fileCount = await this.objectStorageService.downloadPrefix(prefix, path.dirname(playlistPath));
    if (!fs.existsSync(playlistPath)) {
      throw new Error(`rendition ${height}p not found in bucket under ${prefix} (${fileCount} files)`);
    }
    console.log(`rendition ${height}p downloaded for asset ${assetId}: ${fileCount} files`);
  }
}
