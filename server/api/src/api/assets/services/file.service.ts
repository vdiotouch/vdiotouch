import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { FileDocument } from '@/src/api/assets/schemas/files.schema';
import { AssetService } from '@/src/api/assets/services/asset.service';
import { JobManagerService } from '@/src/api/assets/services/job-manager.service';
import { Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { Constants, terminal, Utils } from 'video-touch-common';
import { WebhookService } from '@/src/api/webhook/services/webhook.service';
import fs from 'fs';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { AssetDocument } from '@/src/api/assets/schemas/assets.schema';
import { FileMapper } from '@/src/api/assets/mapper/file.mapper';
import { FILE_TYPE } from 'video-touch-common/dist/constants';
import { getTranscriptFileName } from 'video-touch-common/dist/utils';
import { TranscriptService } from '@/src/api/assets/services/transcript.service';
import { getCdnFileUrl } from '@/src/common/utils';
import { CdnService } from './cdn.service';
import { MasterManifestService } from '@/src/api/assets/services/master-manifest.service';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import { getAudioChunksPrefix } from '@/src/common/object-storage/object-storage-keys';

@Injectable()
export class FileService {
  constructor(
    private repository: FileRepository,
    private assetService: AssetService,
    private jobManagerService: JobManagerService,
    private webhookService: WebhookService,
    private transcriptService: TranscriptService,
    private cdnService: CdnService,
    private masterManifestService: MasterManifestService,
    private objectStorageService: ObjectStorageService
  ) {}

  async updateFileStatus(fileId: string, status: string, details: string, size?: number) {
    let file = await this.repository.findOne({
      _id: mongoose.Types.ObjectId(fileId),
    });
    if (!file) {
      throw new Error(`File with id ${fileId} not found`);
    }

    let updatedData: mongoose.UpdateQuery<FileDocument> = {
      latest_status: status,
      $push: {
        status_logs: {
          status: status,
          details: details,
        },
      },
    };
    if (size && file.type !== Constants.FILE_TYPE.SOURCE) {
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

  async afterUpdateFileLatestStatus(oldDoc: FileDocument, assetDocument: AssetDocument) {
    console.log('oldDoc ', oldDoc);
    let updatedFile = await this.repository.findOne({
      _id: mongoose.Types.ObjectId(oldDoc._id.toString()),
    });

    let cdnUrl = getCdnFileUrl(updatedFile, CdnService.getCdnBaseUrl());

    this.webhookService.publishFileEvent(updatedFile, assetDocument, cdnUrl).catch((err) => {
      console.log('error while publishing webhook event ', err);
    });

    if (
      updatedFile.type === Constants.FILE_TYPE.AUDIO &&
      updatedFile.latest_status === Constants.FILE_STATUS.READY &&
      assetDocument.with_transcription
    ) {
      this.checkForTranscriptionGeneration(updatedFile, assetDocument)
        .then()
        .catch((err) => {
          console.log('error while checking transcription generation', err);
        });
    }

    let assetId = updatedFile.asset_id;

    if (updatedFile.latest_status == Constants.FILE_STATUS.READY && updatedFile.type === Constants.FILE_TYPE.PLAYLIST) {
      if (this.masterManifestService.isEnabled()) {
        // The master lists the READY renditions, so rewrite it before the CDN cache is cleared.
        await this.masterManifestService.rebuild(assetId.toString()).catch((err) => {
          console.log('error while writing master playlist for asset ', assetId.toString(), err);
        });
      }
      this.cdnService
        .invalidateCache(updatedFile.asset_id.toString())
        .then(() => {
          console.log('cache invalidation completed for file ', updatedFile._id.toString(), updatedFile.name);
        })
        .catch((err) => {
          console.log('error while invalidating cache for file ', updatedFile._id.toString(), updatedFile.name, err);
        });
      this.checkDownloadFileGeneration(updatedFile)
        .then()
        .catch((err) => {
          console.log('error while checking download file generation', err);
        });

      //TODO: should remove this block after implementing m3u8 file cache invalidation
      this.assetService
        .updateMasterFileVersion(assetId.toString())
        .then((data) => {
          console.log('updated master file version ', data);
        })
        .catch((err) => {
          console.log('error while updating master file version', err);
        });
    }
    if (updatedFile.latest_status === Constants.FILE_STATUS.READY) {
      if (assetDocument.with_transcoding) {
        if (
          updatedFile.latest_status === Constants.FILE_STATUS.READY &&
          updatedFile.type === Constants.FILE_TYPE.PLAYLIST
        ) {
          this.assetService
            .checkForAssetReadyStatus(assetId.toString())
            .then(() => {
              console.log('checked for asset ready status');
            })
            .catch((err) => {
              console.log('error while checking asset ready status', err);
            });
        }
      } else if (assetDocument.with_transcription) {
        if (
          updatedFile.type === Constants.FILE_TYPE.TRANSCRIPT &&
          updatedFile.latest_status === Constants.FILE_STATUS.READY
        ) {
          this.assetService
            .checkForAssetReadyStatus(assetId.toString())
            .then(() => {
              console.log('checked for asset ready status');
            })
            .catch((err) => {
              console.log('error while checking asset ready status', err);
            });
        }
      } else {
        this.assetService
          .checkForAssetReadyStatus(assetId.toString())
          .then(() => {
            console.log('checked for asset ready status');
          })
          .catch((err) => {
            console.log('error while checking asset ready status', err);
          });
      }
    }
    if (
      updatedFile.type === Constants.FILE_TYPE.PARTIAL_TRANSCRIPT &&
      updatedFile.latest_status === Constants.FILE_STATUS.READY
    ) {
      this.transcriptService
        .generateTranscriptByPartialTranscriptFile(updatedFile)
        .then()
        .catch((err) => {
          console.log('error while generating transcript for asset', err);
        });
    }

    if (updatedFile.latest_status === Constants.FILE_STATUS.FAILED) {
      this.assetService
        .checkForAssetFailedStatus(assetId.toString())
        .then()
        .catch((err) => {
          console.log('error while checking asset failed status', err);
        });
    }
  }

  async checkDownloadFileGeneration(updatedFile: FileDocument) {
    let downloadTypeFile = await this.getFileByType(
      updatedFile.asset_id.toString(),
      Constants.FILE_TYPE.DOWNLOAD,
      Constants.FILE_STATUS.QUEUED
    );
    if (!downloadTypeFile) {
      console.log('No download type file found, skipping download file generation');
      return;
    }
    if (downloadTypeFile.height !== updatedFile.height) {
      console.log('Download file height does not match updated file height, skipping download file generation');
      return;
    }
    return this.initDownloadFileGeneration(downloadTypeFile);
  }

  async initDownloadFileGeneration(downloadFile: FileDocument) {
    console.log('Download file found, proceeding with download file generation');
    let jobData = await this.jobManagerService.publishDownloadFileGenerationJob(downloadFile);
    console.log('job published for download file ', jobData);
    if (jobData) {
      await this.repository.findOneAndUpdate(
        {
          _id: downloadFile._id,
        },
        {
          job_id: jobData.id,
        }
      );
    }
  }

  async afterSave(doc: FileDocument) {
    try {
      if (doc.type === Constants.FILE_TYPE.PLAYLIST) {
        console.log('file type is playlist, skipping further processing');
        let jobModel = this.jobManagerService.getJobData(doc);
        let jobData = await this.jobManagerService.publishVideoProcessingJob(jobModel);
        console.log('job published for playlist file ', jobData);
        if (jobData) {
          await this.repository.findOneAndUpdate(
            {
              _id: doc._id,
            },
            {
              job_id: jobData.id,
            }
          );
        }
      }
      if (doc.type === Constants.FILE_TYPE.THUMBNAIL) {
        let jobData = await this.jobManagerService.publishThumbnailGenerationJob(doc);
        if (jobData) {
          console.log('thumbnail generation job published for file ', jobData);
          await this.repository.findOneAndUpdate(
            {
              _id: doc._id,
            },
            {
              job_id: jobData.id,
            }
          );
        }
      }
      if (doc.type === Constants.FILE_TYPE.SOURCE) {
        console.log('file type is download, skipping further processing');
        let jobData = await this.jobManagerService.publishSourceFileUploadJob(doc);
        console.log('job published for download file ', jobData);
        if (jobData) {
          await this.repository.findOneAndUpdate(
            {
              _id: doc._id,
            },
            {
              job_id: jobData.id,
            }
          );
        }
      }
      if (doc.type === Constants.FILE_TYPE.AUDIO) {
        console.log('Audio file found, proceeding with audio file generation');
        let jobData = await this.jobManagerService.publishAudioFileGenerationJob(doc);
        console.log('job published for audio file ', jobData);
        if (jobData) {
          await this.repository.findOneAndUpdate(
            {
              _id: doc._id,
            },
            {
              job_id: jobData.id,
            }
          );
        }
      }
      if (doc.type === FILE_TYPE.PARTIAL_TRANSCRIPT) {
        console.log('Transcription file found, proceeding with transcription file generation');
        let jobData = await this.jobManagerService.publishTranscriptionGenerationJob(doc);
        console.log('job published for transcription file ', jobData);
        if (jobData) {
          await this.repository.findOneAndUpdate(
            {
              _id: doc._id,
            },
            {
              job_id: jobData.id,
            }
          );
        }
      }
    } catch (err) {
      console.error('Error in afterSave for file service: ', err);
    }
  }

  async getFileByType(assetId: string, type: string, status: string): Promise<FileDocument | null> {
    return this.repository.findOne({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: type,
      latest_status: status,
    });
  }

  async createPartialTranscriptionFile(
    assetId: string,
    transcriptFileName: string,
    audioFileName: string,
    audioStartTime: string
  ) {
    let fileToBeSaved = FileMapper.mapForSave(
      assetId,
      transcriptFileName,
      FILE_TYPE.PARTIAL_TRANSCRIPT,
      0,
      0,
      Constants.FILE_STATUS.QUEUED,
      'Transcription file queued for processing',
      0,
      {
        audio_start_time: audioStartTime,
        audio_file_name: audioFileName,
      }
    );
    return this.repository.create(fileToBeSaved);
  }

  async createTranscriptionFile(assetId: string) {
    let fileToBeSaved = FileMapper.mapForSave(
      assetId,
      getTranscriptFileName(),
      FILE_TYPE.TRANSCRIPT,
      0,
      0,
      Constants.FILE_STATUS.QUEUED,
      'Transcription file queued for processing',
      0
    );
    return this.repository.create(fileToBeSaved);
  }

  async checkForTranscriptionGeneration(updatedFile: FileDocument, asset: AssetDocument) {
    console.log('Checking for transcription generation settings');
    if (!AppConfigService.appConfig.TRANSCRIPTION_GENERATION_ENABLED || !asset.with_transcription) {
      console.log('transcription generation is disabled. Skipping transcription file creation.');
      return;
    }

    const assetId = updatedFile.asset_id.toString();
    // Stateless: audio-worker already split the mp3 and uploaded the chunks. Shared disk (bunny): split it here.
    const chunkNames = this.objectStorageService.isEnabled()
      ? await this.listAudioChunksInBucket(assetId)
      : await this.splitLocalAudio(assetId);
    if (!chunkNames.length) {
      console.log('No audio chunks found, skipping transcription generation');
      return;
    }

    let startTimeSeconds = 0;
    for (let i = 0; i < chunkNames.length; i++) {
      await this.createPartialTranscriptionFile(
        asset._id.toString(),
        `transcript_${i}.json`,
        chunkNames[i],
        this.formatSecondsToHHMMSS(startTimeSeconds)
      );
      startTimeSeconds += AppConfigService.appConfig.AUDIO_CHUNK_DURATION_IN_SEC;
      console.log(`Created transcription file for chunk: ${chunkNames[i]}`);
    }

    await this.createTranscriptionFile(asset._id.toString());
  }

  /** Chunk file names (000.mp3, 001.mp3, …) under audio/<id>/chunks/, in playback order. */
  async listAudioChunksInBucket(assetId: string): Promise<string[]> {
    const prefix = getAudioChunksPrefix(assetId);
    const keys = await this.objectStorageService.listKeys(prefix);
    return this.sortChunkNames(keys.map((key) => key.slice(prefix.length)));
  }

  /** Splits the mp3 on the shared disk into chunks and returns their file names in playback order. */
  async splitLocalAudio(assetId: string): Promise<string[]> {
    let audioFilePath = Utils.getLocalMp3Path(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
    if (!fs.existsSync(audioFilePath)) {
      console.log('Audio file does not exist, skipping transcription generation');
      return [];
    }

    let outputDir = `${Utils.getLocalVideoRootPath(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY)}/audio_chunks/`;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    await this.splitAudio(audioFilePath, outputDir);
    return this.sortChunkNames(fs.readdirSync(outputDir));
  }

  private sortChunkNames(names: string[]): string[] {
    return [...names].sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
  }

  async splitAudio(inputFilePath: string, outputDir: string) {
    console.log(`Splitting audio file ${inputFilePath} into directory ${outputDir}`);
    const command = `ffmpeg -i ${inputFilePath} -f segment -segment_time ${AppConfigService.appConfig.AUDIO_CHUNK_DURATION_IN_SEC} -c copy ${outputDir}%03d.mp3`;
    await terminal(command);
    console.log('Audio splitting completed');
  }

  formatSecondsToHHMMSS(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [hours, minutes, secs].map((unit) => unit.toString().padStart(2, '0')).join(':');
  }
}
