import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/src/common/database/repository/base.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FILE_COLLECTION_NAME, FileDocument } from '@/src/api/assets/schemas/files.schema';

@Injectable()
export class FileRepository extends BaseRepository<FileDocument> {
  constructor(@InjectModel(FILE_COLLECTION_NAME) private fileDocumentModel: Model<FileDocument>) {
    super(fileDocumentModel);
  }

  async findAssetIdsWithExcludedStatuses(excludedStatuses: string[]): Promise<string[]> {
    const result = await this.fileDocumentModel.aggregate([
      {
        $match: { latest_status: { $nin: excludedStatuses } },
      },
      {
        $group: {
          _id: '$asset_id',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ]);

    return result.map((item) => item._id.toString());
  }
}
