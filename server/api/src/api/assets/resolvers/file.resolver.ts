import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { File } from '../models/file.model';
import { FileRepository } from '../repositories/file.repository';
import { AssetRepository } from '../repositories/asset.repository';
import { getCdnFileUrl } from '@/src/common/utils';
import { CdnService } from '../services/cdn.service';
import { GqlAuthGuard } from '@/src/api/auth/guards/gql-auth.guard';
import { UserInfoDec } from '@/src/common/decorators/user-info.decorator';
import { UserDocument } from '@/src/api/auth/schemas/user.schema';

@Resolver(() => File)
export class FileResolver {
  constructor(private fileRepository: FileRepository, private assetRepository: AssetRepository) {}

  @Query(() => String, { name: 'GetFileUrl' })
  @UseGuards(GqlAuthGuard)
  async getFileUrl(@Args('id') fileId: string, @UserInfoDec() user: UserDocument) {
    if (!Types.ObjectId.isValid(fileId)) {
      throw new NotFoundException('file not found');
    }
    let file = await this.fileRepository.findOne({ _id: Types.ObjectId(fileId) });
    // Same 404 for "no such file" and "someone else's file", so file ids can't be probed.
    let ownsAsset = file && (await this.assetRepository.findOne({ _id: file.asset_id, user_id: user._id }));
    if (!ownsAsset) {
      throw new NotFoundException('file not found');
    }
    return getCdnFileUrl(file, CdnService.getCdnBaseUrl());
  }
}
