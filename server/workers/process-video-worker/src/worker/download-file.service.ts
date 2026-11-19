import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { Utils } from 'video-touch-common';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import { TranscodingService } from '@/src/worker/transcoding.service';

/**
 * Builds the downloadable MP4 from a rendition in the bucket and uploads it straight to its playback path
 * (videos/<id>/<name>), so the mp4 step needs no upload-video-worker and no shared disk.
 */
@Injectable()
export class DownloadFileService {
  constructor(
    private objectStorageService: ObjectStorageService,
    private transcodingService: TranscodingService,
  ) {}

  /** Returns the MP4's size in bytes, reported on the file's READY event (as upload-video-worker did). */
  async createAndUploadMp4(assetId: string, height: number, name: string): Promise<number> {
    let renditionDir = this.transcodingService.getLocalMp4RenditionDir(assetId, height);
    let localFilePath = this.transcodingService.getLocalDownloadFilePath(assetId, name);
    try {
      let playlistPath = await this.downloadRendition(assetId, height, renditionDir);

      let res = await this.transcodingService.createMp4FromM3u8(playlistPath, localFilePath);
      console.log(`video ${height}p download:`, res);

      let key = Utils.getServerDownloadFilePath(assetId, name);
      await this.objectStorageService.uploadFile(key, localFilePath);
      console.log(`download file ${height}p uploaded for asset ${assetId}: ${key}`);

      const stats = await fs.promises.stat(localFilePath);
      return stats.size;
    } finally {
      this.transcodingService.removeLocalPath(localFilePath);
      this.transcodingService.removeLocalPath(renditionDir);
    }
  }

  /** Fetches the rendition the transcoder put in the bucket. Returns its local playlist path. */
  private async downloadRendition(assetId: string, height: number, renditionDir: string): Promise<string> {
    let prefix = `${Utils.getBunnyUriVideoPathByHeight(assetId, height)}/`;
    let fileCount = await this.objectStorageService.downloadPrefix(prefix, renditionDir);
    let playlistPath = `${renditionDir}/${Utils.getFileName(height)}`;
    if (!fs.existsSync(playlistPath)) {
      throw new Error(`rendition ${height}p not found in bucket under ${prefix} (${fileCount} files)`);
    }
    console.log(`rendition ${height}p downloaded for asset ${assetId}: ${fileCount} files`);
    return playlistPath;
  }
}
