import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OnModuleInit } from '@nestjs/common';
import * as console from 'node:console';
import * as fs from 'node:fs';
import { Constants, terminal, Utils } from 'video-touch-common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { FileStatusPublisher } from '@/src/worker/file-status.publisher';
import { AudioDownloadService } from '@/src/worker/audio-download.service';
import { AudioSplitJobModel } from '@/src/worker/models/audio-split-job.model';
import { checkLastAttempt } from '@/src/common/utils';

/**
 * Splits an asset's audio.mp3 into the chunks the transcription jobs consume.
 *
 * The API creates the TRANSCRIPT file row and publishes this job, then waits for the PROCESSING
 * status below before fanning out one PARTIAL_TRANSCRIPT row per chunk. It reads the chunk
 * directory off the shared temp volume, so nothing about the chunk list travels in the reply.
 */
@Processor(process.env.BULL_AUDIO_SPLIT_JOB_QUEUE)
export class AudioSplitWorker extends WorkerHost implements OnModuleInit {
  constructor(
    private fileStatusPublisher: FileStatusPublisher,
    private audioDownloadService: AudioDownloadService,
  ) {
    super();
  }

  onModuleInit() {
    console.log('AudioSplitWorker initialized with queue:', process.env.BULL_AUDIO_SPLIT_JOB_QUEUE);
  }

  async process(job: Job): Promise<any> {
    console.log('AudioSplitWorker', job.data);
    let msg: AudioSplitJobModel = job.data as AudioSplitJobModel;
    let isLastAttempt = checkLastAttempt(job);

    try {
      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'Audio split started',
        0,
        Constants.FILE_STATUS.PROCESSING,
      );

      let audioFilePath = await this.resolveAudioFile(msg);
      let chunkCount = await this.splitAudio(msg.asset_id, audioFilePath, msg.chunk_duration_in_sec);

      // this is the signal the API acts on — dir_size stays 0 because updateFileStatus writes it
      // onto the file as `size`, and the transcript file's own size is set when it is uploaded
      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        `Audio split into ${chunkCount} chunks`,
        0,
        Constants.FILE_STATUS.PROCESSING,
      );
      console.log(`audio split into ${chunkCount} chunks successfully`);
    } catch (e: any) {
      console.log(`error while splitting ${msg.asset_id} audio`, e, isLastAttempt);

      if (isLastAttempt) {
        this.fileStatusPublisher.publishUpdateFileStatusEvent(
          msg.file_id.toString(),
          e.message,
          0,
          Constants.FILE_STATUS.FAILED,
        );
        return;
      }
      throw new Error(`Error while splitting audio of assetId ${msg.asset_id}: ${e.message}`);
    }
  }

  /**
   * The mp3 is usually still on the shared temp volume from the extraction run. It is only gone
   * once the cleanup cron has reaped the asset's directory, which is the case this endpoint
   * exists to serve — transcribing an asset processed some time ago.
   */
  private async resolveAudioFile(msg: AudioSplitJobModel): Promise<string> {
    let audioFilePath = Utils.getLocalMp3Path(msg.asset_id, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);

    if (fs.existsSync(audioFilePath) && fs.statSync(audioFilePath).size > 0) {
      console.log('using local audio file ', audioFilePath);
      return audioFilePath;
    }

    if (!msg.audio_url) {
      throw new Error('Audio file is not available locally and no audio_url was provided');
    }
    await this.audioDownloadService.download(msg.audio_url, audioFilePath);
    return audioFilePath;
  }

  async splitAudio(assetId: string, audioFilePath: string, chunkDurationInSec: number): Promise<number> {
    let outputDir = Utils.getLocalAudioChunksDir(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);

    // a shorter re-run leaves the tail of the previous run behind, and the API lists this
    // directory to decide how many chunks there are
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`Splitting audio file ${audioFilePath} into directory ${outputDir}`);
    const command = `ffmpeg -i ${audioFilePath} -f segment -segment_time ${chunkDurationInSec} -c copy ${outputDir}/%03d.mp3`;
    await terminal(command);
    console.log('Audio splitting completed');

    let chunkCount = fs.readdirSync(outputDir).length;
    if (chunkCount === 0) {
      throw new Error('Audio splitting produced no chunks');
    }
    return chunkCount;
  }
}
