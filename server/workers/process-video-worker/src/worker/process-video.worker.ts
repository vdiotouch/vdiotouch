import { Constants, Models, terminal } from 'video-touch-common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { checkIsLastAttempt } from '@/src/common/utils';
import { FileStatusPublisher } from '@/src/worker/file-status.publisher';
import { RenditionUploadService } from '@/src/worker/rendition-upload.service';
import { DownloadFileService } from '@/src/worker/download-file.service';

@Processor(process.env.BULL_PROCESS_VIDEO_JOB_QUEUE, { lockDuration: 1000 * 60 * 60 * 1 }) // 1 hour lock duration
export class ProcessVideoWorker extends WorkerHost {
  constructor(
    private fileStatusPublisher: FileStatusPublisher,
    private renditionUploadService: RenditionUploadService,
    private downloadFileService: DownloadFileService,
  ) {
    super();
    console.log('ProcessVideoWorker initialized');
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
      if (msg.type === Constants.FILE_TYPE.PLAYLIST) {
        let size = await this.renditionUploadService.transcodeAndUploadRendition(
          msg.asset_id.toString(),
          height,
          width,
        );
        this.fileStatusPublisher.publishUpdateFileStatusEvent(
          msg.file_id.toString(),
          'File uploaded',
          size,
          Constants.FILE_STATUS.READY,
        );
      }
      if (msg.type === Constants.FILE_TYPE.DOWNLOAD) {
        let size = await this.downloadFileService.createAndUploadMp4(msg.asset_id.toString(), height, msg.name);
        this.fileStatusPublisher.publishUpdateFileStatusEvent(
          msg.file_id.toString(),
          'File uploaded',
          size,
          Constants.FILE_STATUS.READY,
        );
      }
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

  async getMetadata(url: string): Promise<{
    file_name: string;
    size: number;
    height: number;
    width: number;
    duration: number;
  }> {
    let extractMetaCommand = `ffprobe -v quiet -show_streams -show_format -print_format json ${url}`;
    let showStreamCommandRes = await terminal(extractMetaCommand);
    let parsedData = JSON.parse(showStreamCommandRes);
    let videoInfo = parsedData.streams[0];
    let format = parsedData.format;

    return {
      file_name: format.filename,
      size: +format.size,
      height: videoInfo.height,
      width: videoInfo.width,
      duration: +videoInfo.duration,
    };
  }
}
