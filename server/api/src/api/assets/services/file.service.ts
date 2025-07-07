import { Injectable } from '@nestjs/common';
import { Constants, Utils } from 'video-touch-common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import mongoose from 'mongoose';
import { FileDocument } from '@/src/api/assets/schemas/files.schema';
import { AssetService } from '@/src/api/assets/services/asset.service';
import { AssetDocument } from '@/src/api/assets/schemas/assets.schema';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import fs from 'fs';

@Injectable()
export class FileService {
  constructor(private repository: FileRepository, private assetService: AssetService) {}

  async updateFileStatus(fileId: string, status: string, details: string, size?: number) {
    let updatedData: mongoose.UpdateQuery<FileDocument> = {
      latest_status: status,
      $push: {
        status_logs: {
          status: status,
          details: details,
        },
      },
    };
    if (size) {
      updatedData = {
        ...updatedData,
        size: size,
      };
    }

    return this.repository.findOneAndUpdate(
      {
        _id: mongoose.Types.ObjectId(fileId),
      },
      updatedData
    );
  }

  async afterUpdateFileLatestStatus(oldDoc: FileDocument) {
    console.log('oldDoc ', oldDoc);
    let updatedFile = await this.repository.findOne({
      _id: mongoose.Types.ObjectId(oldDoc._id.toString()),
    });
    if (updatedFile.type === Constants.FILE_TYPE.THUMBNAIL) {
      return;
    }
    let assetId = updatedFile.asset_id;

    if (updatedFile.latest_status == Constants.FILE_STATUS.READY) {
      this.assetService
        .checkForDeleteLocalAssetFile(assetId.toString())
        .then((data) => {
          console.log('checked local video file');
        })
        .catch((err) => {
          console.log('error while checking local file ', err);
        });

      this.assetService
        .checkForAssetReadyStatus(assetId.toString())
        .then(() => {
          console.log('checked for asset ready status');
        })
        .catch((err) => {
          console.log('error while checking asset ready status', err);
        });
      this.assetService
        .updateMasterFileVersion(assetId.toString())
        .then((data) => {
          console.log('updated master file version ', data);
        })
        .catch((err) => {
          console.log('error while updating master file version', err);
        });
    }
    if (updatedFile.latest_status === Constants.FILE_STATUS.FAILED) {
      await this.assetService.checkForAssetFailedStatus(assetId.toString());
    }
    if (
      updatedFile.latest_status === Constants.FILE_STATUS.READY ||
      updatedFile.latest_status === Constants.FILE_STATUS.FAILED
    ) {
      this.removeLocalFile(updatedFile.asset_id.toString(), updatedFile._id.toString());
    }
  }

  async listThumbnailFiles(items: AssetDocument[]): Promise<FileDocument[]> {
    let assetIds = items.map((item) => item._id);
    return this.repository.find({
      asset_id: { $in: assetIds },
      latest_status: Constants.FILE_STATUS.READY,
      type: Constants.FILE_TYPE.THUMBNAIL,
    });
  }

  async getThumbnailFile(assetId: string) {
    return this.repository.findOne({
      asset_id: mongoose.Types.ObjectId(assetId),
      latest_status: Constants.FILE_STATUS.READY,
      type: Constants.FILE_TYPE.THUMBNAIL,
    });
  }

  private removeLocalFile(assetId: string, fileId: string) {
    console.log('deleting local  file ', fileId);
    let localPath = `${Utils.getLocalVideoRootPath(
      assetId,
      AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY
    )}/${fileId}`;
    console.log('local path ', localPath);
    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
      console.log('local file deleted successfully');
    }
  }
}
