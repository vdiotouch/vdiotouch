import { Processor, WorkerHost } from '@nestjs/bullmq';
import * as console from 'node:console';
import { Job } from 'bullmq';
import fs from 'node:fs';
import { OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { Constants, Models, Utils } from 'video-touch-common';
import { FileStatusPublisher } from '@/src/worker/file-status.publisher';
import { AudioExtractionService } from '@/src/worker/audio-extraction.service';
import { AudioStorageService } from '@/src/worker/audio-storage.service';

@Processor(process.env.BULL_AUDIO_EXTRACTION_JOB_QUEUE)
export class AudioExtractionWorker extends WorkerHost implements OnModuleInit {
  constructor(
    private fileStatusPublisher: FileStatusPublisher,
    private audioExtractionService: AudioExtractionService,
    private audioStorageService: AudioStorageService,
  ) {
    super();
  }

  onModuleInit() {
    console.log('AudioExtractionWorker initialized with queue:', process.env.BULL_AUDIO_EXTRACTION_JOB_QUEUE);
  }

  async process(job: Job): Promise<any> {
    console.log('AudioExtractionWorker', job.data);
    let msg: Models.AudioExtractionJobModel = job.data as Models.AudioExtractionJobModel;
    let isLastAttempt = this.isLastAttempt(job);

    try {
      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'Audio extraction started',
        0,
        Constants.FILE_STATUS.PROCESSING,
      );

      let tempDir = AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY;
      let outputFolderPath = Utils.getLocalVideoRootPath(msg.asset_id, tempDir);
      let mp3Path = Utils.getLocalMp3Path(msg.asset_id, tempDir);
      let chunksDir = Utils.getLocalAudioChunksDir(msg.asset_id, tempDir);
      let size: number;
      try {
        let inputFilePath = await this.audioStorageService.getSourceVideoInput(msg.asset_id);
        await this.audioExtractionService.extractAudio(inputFilePath, outputFolderPath);
        console.log('audio extracted successfully');

        // Chunks go first: on AUDIO READY the api lists them to create the PARTIAL_TRANSCRIPT rows.
        if (AppConfigService.appConfig.TRANSCRIPTION_GENERATION_ENABLED) {
          await this.audioStorageService.splitAndUploadChunks(msg.asset_id, mp3Path, chunksDir);
        }
        size = await this.audioStorageService.uploadAudio(msg.asset_id, msg.name, mp3Path);
        console.log('audio uploaded');
      } finally {
        // Only this job's files: other jobs of this process may be using the same asset folder.
        fs.rmSync(mp3Path, { force: true });
        fs.rmSync(chunksDir, { recursive: true, force: true });
      }

      // After the cleanup, so the next jobs never race it.
      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'Audio file uploaded',
        size,
        Constants.FILE_STATUS.READY,
      );
    } catch (e: any) {
      console.log(`error while extracting ${msg.asset_id} audio`, e, isLastAttempt);

      if (isLastAttempt) {
        this.fileStatusPublisher.publishUpdateFileStatusEvent(
          msg.file_id.toString(),
          e.message,
          0,
          Constants.FILE_STATUS.FAILED,
        );
        return;
      }
      throw new Error(`Error while extracting audio of assetId ${msg.asset_id}p: ${e.message}`);
    }
  }

  isLastAttempt(job: Job): boolean {
    console.log(`Job ${job.id} attempts made: ${job.attemptsMade}, max attempts: ${job.opts.attempts}`);

    // Check if the job has been retried more than the maximum allowed attempts
    if (job.attemptsMade + 1 >= job.opts.attempts) {
      console.log(`Job ${job.id} has reached the maximum retry limit.`);
      return true; // This is the last attempt
    }
    return false; // There are more attempts left
  }

  buildAssetUpdateEventModel(assetId: string, status: string, details: string): Models.UpdateAssetStatusEventModel {
    return {
      asset_id: assetId,
      status: status,
      details: details,
    };
  }
}
