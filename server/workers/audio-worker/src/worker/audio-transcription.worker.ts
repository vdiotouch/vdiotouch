import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { Constants, Models, Utils } from 'video-touch-common';
import { FileStatusPublisher } from '@/src/worker/file-status.publisher';
import { AudioTranscriptionProviderFactory } from '@/src/common/gen-ai-models/audio-transcription-provider.factory';
import * as fs from 'node:fs';
import { AudioStorageService } from '@/src/worker/audio-storage.service';

@Processor(process.env.BULL_AUDIO_TRANSCRIPTION_JOB_QUEUE, {
  concurrency: 3,
})
export class AudioTranscriptionWorker extends WorkerHost implements OnModuleInit {
  constructor(
    private fileStatusPublisher: FileStatusPublisher,
    private transcriptionProviderFactory: AudioTranscriptionProviderFactory,
    private audioStorageService: AudioStorageService,
  ) {
    super();
  }

  onModuleInit() {
    console.log('AudioTranscriptionWorker initialized with queue:', process.env.BULL_AUDIO_TRANSCRIPTION_JOB_QUEUE);
  }

  async process(job: Job): Promise<any> {
    console.log('AudioTranscriptionWorker', job.data);
    let msg: Models.AudioTranscriptionJobModel = job.data as Models.AudioTranscriptionJobModel;
    let isLastAttempt = this.isLastAttempt(job);

    try {
      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'Audio transcription started',
        0,
        Constants.FILE_STATUS.PROCESSING,
      );

      // A folder per job: up to 3 transcriptions of the same asset run at once in this process.
      let assetDir = Utils.getLocalVideoRootPath(msg.asset_id, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
      let jobDir = `${assetDir}/transcription_${msg.file_id}`;
      let inputFilePath = `${jobDir}/${msg.audio_file_name}`;
      let outputJsonPath = `${jobDir}/${msg.name}`;
      try {
        // The chunk was uploaded by audio extraction, possibly on another machine.
        await this.audioStorageService.downloadChunk(msg.asset_id, msg.audio_file_name, inputFilePath);

        const provider = this.transcriptionProviderFactory.getProvider();
        await provider.transcribeAudio(inputFilePath, outputJsonPath);
        // The merge may run on another machine, so it reads the partial from the bucket.
        await this.audioStorageService.uploadPartialTranscript(msg.asset_id, msg.name, outputJsonPath);
      } finally {
        // Holds only this job's chunk and partial JSON.
        fs.rmSync(jobDir, { recursive: true, force: true });
      }

      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'Audio transcription completed',
        0,
        Constants.FILE_STATUS.READY,
      );
      console.log('audio transcribed successfully');
    } catch (e: any) {
      console.log(`error while transcribing ${msg.asset_id} audio`, e, isLastAttempt);

      if (isLastAttempt) {
        this.fileStatusPublisher.publishUpdateFileStatusEvent(
          msg.file_id.toString(),
          e.message,
          0,
          Constants.FILE_STATUS.FAILED,
        );
        return;
      }
      throw new Error(`Error while transcribing audio of assetId ${msg.asset_id}p: ${e.message}`);
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
}
