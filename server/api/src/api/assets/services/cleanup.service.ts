import { Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { Constants } from 'video-touch-common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { AssetRepository } from '@/src/api/assets/repositories/asset.repository';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import { getAssetWorkingPrefixes, getSourceObjectKey } from '@/src/common/object-storage/object-storage-keys';

// Keys look like sources/<asset_id>/source.mp4; the segment after this prefix is the asset id.
const SOURCES_PREFIX = 'sources/';

/**
 * Deletes an asset's working files in the bucket (source copy, audio chunks, partial transcripts) once nothing
 * needs them any more. Playback files under videos/ are never touched. Replaces the old shared-disk cleanup.
 */
@Injectable()
export class CleanupService {
  constructor(
    private fileRepository: FileRepository,
    private assetRepository: AssetRepository,
    private objectStorageService: ObjectStorageService
  ) {}

  /**
   * Sweep, called by the cleanup-device cron: every asset that still has a source copy, is READY and has no
   * file left in progress gets its working files deleted.
   */
  async cleanupDevice() {
    const activeAssetIds = await this.fileRepository.findAssetIdsWithStatuses([
      Constants.FILE_STATUS.PROCESSING,
      Constants.FILE_STATUS.QUEUED,
      Constants.FILE_STATUS.FAILED,
    ]);

    const sourceKeys = await this.objectStorageService.listKeys(SOURCES_PREFIX);
    const assetIds = sourceKeys
      .map((key) => key.slice(SOURCES_PREFIX.length).split('/')[0])
      .filter((assetId) => mongoose.isValidObjectId(assetId));
    const assets = await this.assetRepository.find({
      _id: { $in: assetIds.map((assetId) => mongoose.Types.ObjectId(assetId)) },
    });

    for (const assetId of assetIds) {
      const asset = assets.find((a) => a._id.toString() === assetId);
      if (!asset) {
        console.warn(`Asset with ID ${assetId} not found in database, skipping cleanup of ${getSourceObjectKey(assetId)}`);
        continue;
      }
      if (!activeAssetIds.includes(assetId) && asset.latest_status === Constants.VIDEO_STATUS.READY) {
        await this.deleteWorkingFiles(assetId);
      }
    }
  }

  async deleteWorkingFiles(assetId: string) {
    console.log('deleting working files of asset ', assetId);
    for (const prefix of getAssetWorkingPrefixes(assetId)) {
      await this.objectStorageService.deletePrefix(prefix);
    }
  }
}
