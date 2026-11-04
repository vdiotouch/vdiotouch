import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateAssetInputDto } from '@/src/api/assets/dtos/create-asset-input.dto';
import { AssetService } from '@/src/api/assets/services/asset.service';
import { AssetMapper } from '@/src/api/assets/mapper/asset.mapper';
import { StatusDocument } from '@/src/api/assets/schemas/status.schema';
import { UserService } from '@/src/api/auth/services/user.service';
import { AssetRepository } from '@/src/api/assets/repositories/asset.repository';
import mongoose from 'mongoose';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { Constants } from 'video-touch-common';
import { TranscriptService } from '@/src/api/assets/services/transcript.service';
import { TranscriptGenerationService } from '@/src/api/assets/services/transcript-generation.service';
import { JwtAuthGuard } from '@/src/api/auth/guards/jwt-auth.guard';
import { UserInfoDec } from '@/src/common/decorators/user-info.decorator';
import { UserDocument } from '@/src/api/auth/schemas/user.schema';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

@Controller({ version: '1', path: 'assets' })
export class AssetController {
  constructor(
    private assetService: AssetService,
    private userService: UserService,
    private assetRepo: AssetRepository,
    private fileRepo: FileRepository,
    private transcriptService: TranscriptService,
    private transcriptGenerationService: TranscriptGenerationService
  ) {}

  @Post()
  async createAsset(@Body() createAssetInputDto: CreateAssetInputDto) {
    let user = await this.userService.getUserEmail(createAssetInputDto.email);
    if (!user) {
      throw new NotFoundException('User does not exist');
    }
    let createdAsset = await this.assetService.create(createAssetInputDto, user);
    let statusLogs = AssetMapper.toStatusLogsResponse(createdAsset.status_logs as [StatusDocument]);
    return AssetMapper.toAssetResponse(createdAsset, statusLogs);
  }

  /**
   * Transcribes an asset on demand from the audio.mp3 it already has — no re-download of the
   * video, no ffprobe, no transcoding. Creating the transcript file publishes the split job to
   * audio-worker; everything after that is driven by the file status hooks.
   */
  @Post('/:assetId/transcribe')
  @UseGuards(JwtAuthGuard)
  async transcribeAsset(@Param('assetId') assetId: string, @UserInfoDec() user: UserDocument) {
    if (!AppConfigService.appConfig.TRANSCRIPTION_GENERATION_ENABLED) {
      throw new BadRequestException('Transcription generation is disabled');
    }
    if (!mongoose.isValidObjectId(assetId)) {
      throw new BadRequestException('Invalid asset id');
    }

    let asset = await this.assetRepo.findOne({
      _id: mongoose.Types.ObjectId(assetId),
      user_id: user._id,
    });
    if (!asset) {
      throw new NotFoundException('Asset does not exist');
    }

    let audioFile = await this.fileRepo.findOne({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: Constants.FILE_TYPE.AUDIO,
    });
    if (!audioFile) {
      throw new NotFoundException('Audio file does not exist for this asset');
    }
    if (audioFile.latest_status !== Constants.FILE_STATUS.READY) {
      throw new ConflictException(`Audio file is not ready yet. Current status: ${audioFile.latest_status}`);
    }

    // re-triggering mid-run would delete rows whose transcription jobs are still executing
    let hasRunInFlight = await this.transcriptGenerationService.hasRunInFlight(assetId);
    if (hasRunInFlight) {
      throw new ConflictException('Transcript generation is already in progress for this asset');
    }

    await this.transcriptGenerationService.resetTranscriptFiles(assetId);
    let transcriptFile = await this.transcriptGenerationService.createTranscriptFile(assetId);

    return {
      message: 'Transcript generation initiated',
      asset_id: assetId,
      transcript_file_id: transcriptFile._id.toString(),
      status: transcriptFile.latest_status,
    };
  }

  @Post('/:assetId/generate-transcript')
  async generateTranscript(@Param('assetId') assetId: string) {
    let asset = await this.assetRepo.findOne({
      _id: mongoose.Types.ObjectId(assetId),
    });
    if (!asset) {
      throw new NotFoundException('Asset does not exist');
    }

    let transcriptFile = await this.fileRepo.findOne({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: Constants.FILE_TYPE.TRANSCRIPT,
    });
    if (!transcriptFile) {
      throw new NotFoundException('Transcript file does not exist for this asset');
    }
    if (transcriptFile.latest_status === Constants.FILE_STATUS.READY) {
      throw new ForbiddenException('Transcript already generated for this asset');
    }
    await this.transcriptService.generateTranscript(assetId, transcriptFile, true);
    return { message: 'Transcript generation initiated' };
  }
}
