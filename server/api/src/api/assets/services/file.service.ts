import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { FileDocument } from '@/src/api/assets/schemas/files.schema';
import { AssetService } from '@/src/api/assets/services/asset.service';
import { JobManagerService } from '@/src/api/assets/services/job-manager.service';
import { Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { Constants } from 'video-touch-common';
import { WebhookService } from '@/src/api/webhook/services/webhook.service';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { AssetDocument } from '@/src/api/assets/schemas/assets.schema';
import { TranscriptService } from '@/src/api/assets/services/transcript.service';
import { TranscriptGenerationService } from '@/src/api/assets/services/transcript-generation.service';
import { getCdnFileUrl } from '@/src/common/utils';
import { CdnService } from './cdn.service';

@Injectable()
export class FileService {
  constructor(
    private repository: FileRepository,
    private assetService: AssetService,
    private jobManagerService: JobManagerService,
    private webhookService: WebhookService,
    private transcriptService: TranscriptService,
    private transcriptGenerationService: TranscriptGenerationService,
    private cdnService: CdnService
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
      this.checkForTranscriptionGeneration(assetDocument)
        .then()
        .catch((err) => {
          console.log('error while checking transcription generation', err);
        });
    }

    let assetId = updatedFile.asset_id;

    if (updatedFile.latest_status == Constants.FILE_STATUS.READY && updatedFile.type === Constants.FILE_TYPE.PLAYLIST) {
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

    if (
      updatedFile.type === Constants.FILE_TYPE.TRANSCRIPT &&
      updatedFile.latest_status === Constants.FILE_STATUS.PROCESSING
    ) {
      this.createPartialTranscriptsFromChunks(assetId.toString())
        .then()
        .catch((err) => {
          console.log('error while creating partial transcripts from chunks', err);
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
      if (doc.type === Constants.FILE_TYPE.PARTIAL_TRANSCRIPT) {
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
      if (doc.type === Constants.FILE_TYPE.TRANSCRIPT) {
        console.log('Transcript file found, proceeding with audio split');
        let jobData = await this.publishAudioSplitJob(doc);
        console.log('job published for audio split ', jobData);
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

  /**
   * The split job needs the audio file's CDN url as a fallback for when the local copy has
   * already been cleaned up off the shared temp volume.
   */
  async publishAudioSplitJob(transcriptFile: FileDocument) {
    let audioFile = await this.repository.findOne({
      asset_id: transcriptFile.asset_id,
      type: Constants.FILE_TYPE.AUDIO,
    });
    if (!audioFile) {
      console.log('no audio file found for asset, split job will have to rely on the local copy');
    }
    let audioUrl = audioFile ? getCdnFileUrl(audioFile, CdnService.getCdnBaseUrl()) : '';
    return this.jobManagerService.publishAudioSplitJob(transcriptFile, audioUrl);
  }

  /**
   * Runs when audio-worker reports the split is done. FILE_STATUS has no distinct "split done"
   * value and transcript-merger.worker publishes PROCESSING on this same file when the merge
   * starts, so the guard is what stops the merge from re-creating the chunks and looping.
   */
  async createPartialTranscriptsFromChunks(assetId: string) {
    let hasPartialTranscripts = await this.transcriptGenerationService.hasPartialTranscripts(assetId);
    if (hasPartialTranscripts) {
      console.log('partial transcripts already exist for asset, skipping chunk fan-out ', assetId);
      return;
    }

    let chunkNames = this.transcriptGenerationService.readChunkNames(assetId);
    if (chunkNames.length === 0) {
      // the worker only reports the split done once it has counted chunks, so the directory
      // going empty in between means something removed it — fail loudly rather than leave the
      // transcript file sitting in PROCESSING forever
      let transcriptFile = await this.getTranscriptFile(assetId);
      if (transcriptFile) {
        await this.updateFileStatus(
          transcriptFile._id.toString(),
          Constants.FILE_STATUS.FAILED,
          'No audio chunks found after split'
        );
      }
      throw new Error(`No audio chunks found for asset ${assetId}`);
    }
    console.log(`creating ${chunkNames.length} partial transcript files for asset `, assetId);
    return this.transcriptGenerationService.createPartialTranscriptFiles(assetId, chunkNames);
  }

  async getTranscriptFile(assetId: string): Promise<FileDocument | null> {
    return this.repository.findOne({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: Constants.FILE_TYPE.TRANSCRIPT,
    });
  }

  /**
   * The automatic path: the asset's audio has just gone READY and it was ingested with
   * with_transcription. Creating the transcript file is all that is needed — its save hook
   * publishes the split job, and audio-worker takes it from there.
   */
  async checkForTranscriptionGeneration(asset: AssetDocument) {
    console.log('Checking for transcription generation settings');
    if (!AppConfigService.appConfig.TRANSCRIPTION_GENERATION_ENABLED || !asset.with_transcription) {
      console.log('transcription generation is disabled. Skipping transcription file creation.');
      return null;
    }
    let assetId = asset._id.toString();
    // a redelivered audio-ready event would otherwise create a second transcript file, and with
    // it a second split job and a second set of chunks
    let existingTranscriptFile = await this.getTranscriptFile(assetId);
    if (existingTranscriptFile) {
      console.log('transcript file already exists for asset, skipping creation ', assetId);
      return null;
    }
    return this.transcriptGenerationService.createTranscriptFile(assetId);
  }
}
