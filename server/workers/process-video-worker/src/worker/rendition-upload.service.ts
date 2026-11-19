import { Injectable } from '@nestjs/common';
import { Utils } from 'video-touch-common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';

/**
 * Uploads one finished HLS rendition straight to its playback path (videos/<id>/<height>/), so a transcoder
 * needs no upload-video-worker and no shared disk. Only used when object storage is enabled.
 * The local copy stays for now: the mp4 download step still reads it from the shared disk.
 */
@Injectable()
export class RenditionUploadService {
  constructor(private objectStorageService: ObjectStorageService) {}

  isEnabled(): boolean {
    return this.objectStorageService.isEnabled();
  }

  /** Returns the rendition's size in bytes, reported on the file's READY event. */
  async uploadRendition(assetId: string, height: number): Promise<number> {
    const localDir = `${Utils.getLocalVideoRootPath(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY)}/${height}`;
    const fileCount = await this.objectStorageService.uploadDirectory(
      localDir,
      Utils.getBunnyUriVideoPathByHeight(assetId, height),
    );
    console.log(`rendition ${height}p uploaded for asset ${assetId}: ${fileCount} files`);
    return Utils.getDirSize(localDir);
  }
}
