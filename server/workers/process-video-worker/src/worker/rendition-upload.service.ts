import { Injectable } from '@nestjs/common';
import { Utils } from 'video-touch-common';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import { TranscodingService } from '@/src/worker/transcoding.service';

/**
 * Transcodes one HLS rendition into this container's scratch folder and uploads it straight to its playback path
 * (videos/<id>/<height>/). The api writes the master playlist from the READY files.
 */
@Injectable()
export class RenditionUploadService {
  constructor(
    private objectStorageService: ObjectStorageService,
    private transcodingService: TranscodingService,
  ) {}

  /** Returns the rendition's size in bytes, reported on the file's READY event. */
  async transcodeAndUploadRendition(assetId: string, height: number, width: number): Promise<number> {
    const localDir = this.transcodingService.getLocalRenditionDir(assetId, height);
    try {
      let res = await this.transcodingService.transcodeVideoByResolution(assetId, height, width);
      console.log(`video ${height}p transcode:`, res);

      const fileCount = await this.objectStorageService.uploadDirectory(
        localDir,
        Utils.getBunnyUriVideoPathByHeight(assetId, height),
      );
      console.log(`rendition ${height}p uploaded for asset ${assetId}: ${fileCount} files`);
      return await Utils.getDirSize(localDir);
    } finally {
      this.transcodingService.removeLocalPath(localDir);
    }
  }
}
