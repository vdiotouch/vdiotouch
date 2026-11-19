import { Constants, Models } from 'video-touch-common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { checkIsLastAttempt } from '@/src/common/utils';
import { FileStatusPublisher } from '@/src/worker/file-status.publisher';
import { DownloadFileService } from '@/src/worker/download-file.service';

@Processor(process.env.BULL_DOWNLOAD_FILE_GENERATION_JOB_QUEUE, { lockDuration: 1000 * 60 * 60 * 1 }) // 2 hours lock duration
export class DownloadFileGenerationWorker extends WorkerHost {
  constructor(
    private fileStatusPublisher: FileStatusPublisher,
    private downloadFileService: DownloadFileService,
  ) {
    super();
    console.log('Download File Generation  initialized');
  }

  async process(job: Job): Promise<any> {
    let msg: Models.VideoProcessingJobModel = job.data as Models.VideoProcessingJobModel;
    console.log('VideoProcessingJobHandler', msg);
    let isLastAttempt = checkIsLastAttempt(job);

    let { height, width } = msg;
    await this.processVideo(msg, height, width, isLastAttempt);
  }

  async processVideo(msg: Models.VideoProcessingJobModel, height: number, width: number, isLastAttempt: boolean) {
    try {
      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'Video transcoding started',
        0,
        Constants.FILE_STATUS.PROCESSING,
      );
      let size = await this.downloadFileService.createAndUploadMp4(msg.asset_id.toString(), height, msg.name);
      this.fileStatusPublisher.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'File uploaded',
        size,
        Constants.FILE_STATUS.READY,
      );
    } catch (e: any) {
      console.log(`error while processing ${height}p`, e, isLastAttempt);

      if (isLastAttempt) {
        this.fileStatusPublisher.publishUpdateFileStatusEvent(
          msg.file_id.toString(),
          e.message,
          0,
          Constants.FILE_STATUS.FAILED,
        );
        return;
      }
      throw new Error(`Error while processing video at ${height}p: ${e.message}`);
    }
  }
}
