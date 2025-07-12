import { Injectable } from '@nestjs/common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { Constants, Utils } from 'video-touch-common';
import fs from 'fs';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

@Injectable()
export class CleanupService {
  constructor(private fileRepository: FileRepository) {}

  async cleanupDevice() {
    const activeDirectories = await this.fileRepository.findAssetIdsWithStatuses([
      Constants.FILE_STATUS.PROCESSING,
      Constants.FILE_STATUS.QUEUED,
      Constants.FILE_STATUS.FAILED,
    ]);

    let allDirectories = fs.readdirSync(AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY, { withFileTypes: true });
    for (const dir of allDirectories) {
      if (dir.isDirectory() && !activeDirectories.includes(dir.name)) {
        let localPath = Utils.getLocalVideoRootPath(dir.name, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
        console.log('deleting local path ', localPath);
        if (fs.existsSync(localPath)) {
          fs.rmSync(localPath, { recursive: true, force: true });
        }
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
