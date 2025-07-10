import { Injectable } from '@nestjs/common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { Constants, Utils } from 'video-touch-common';
import fs from 'fs';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

@Injectable()
export class CleanupService {
  constructor(private fileRepository: FileRepository) {}

  async cleanupDevice() {
    // Get all asset_ids that have files with statuses other than processing and failed
    const assetIdsWithNonProcessingOrFailedFiles = await this.fileRepository.findAssetIdsWithExcludedStatuses([
      Constants.FILE_STATUS.PROCESSING,
      Constants.FILE_STATUS.QUEUED,
    ]);

    for (const assetId of assetIdsWithNonProcessingOrFailedFiles) {
      let localPath = Utils.getLocalVideoRootPath(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
      console.log('local path ', localPath);
      if (fs.existsSync(localPath)) {
        fs.rmSync(localPath, { recursive: true, force: true });
      }
    }
  }

  deleteLocalAssetFile(_id: string) {
    console.log('deleting local asset file ', _id);
    let localPath = Utils.getLocalVideoRootPath(_id, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
    console.log('local path ', localPath);
    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }
  }
}
