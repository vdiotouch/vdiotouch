import { RabbitMqService } from '@/src/common/rabbit-mq/service/rabbitmq.service';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import * as process from 'node:process';
import * as console from 'node:console';
import { Job } from 'bullmq';
import { Constants, Models, Utils } from 'video-touch-common';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import { getSourceObjectKey } from '@/src/common/object-storage/object-storage-keys';

/**
 * Only SOURCE jobs (published by the api) reach this worker: the source is already in the bucket, so it is
 * copied to its playback path. Renditions, mp4, audio and transcripts are uploaded by the worker that makes them.
 */
@Processor(process.env.BULL_UPLOAD_JOB_QUEUE, { concurrency: 3 })
export class VideoUploaderJobHandler extends WorkerHost {
  constructor(
    private rabbitMqService: RabbitMqService,
    private objectStorageService: ObjectStorageService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    let msg: Models.FileUploadJobModel = job.data as Models.FileUploadJobModel;
    console.log(`uploading ${msg.type} file`, msg.asset_id.toString());
    let isLastAttempt = this.isLastAttempt(job);

    if (msg.type === Constants.FILE_TYPE.SOURCE) {
      return this.uploadSourceFile(msg, isLastAttempt);
    }
    // Stale job from before the stateless pipeline: nothing to upload, and throwing would only retry it.
    console.log(`skipping upload job ${job.id}: type ${msg.type} is uploaded by the worker that makes it`);
    return;
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

  async uploadSourceFile(msg: Models.FileUploadJobModel, isLastAttempt: boolean) {
    try {
      const sourceKey = getSourceObjectKey(msg.asset_id.toString());
      const destinationKey = Utils.getServerSourceFileVideoPath(msg.asset_id.toString(), msg.name);
      await this.objectStorageService.copyObject(sourceKey, destinationKey);
      console.log(`source file copied in bucket: ${sourceKey} -> ${destinationKey}`);

      this.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'Source file uploaded',
        msg.size,
        Constants.FILE_STATUS.READY,
      );
    } catch (err: any) {
      console.log('error in uploading source file', err);

      if (isLastAttempt) {
        this.publishUpdateFileStatusEvent(
          msg.file_id.toString(),
          'Source file uploading failed',
          0,
          Constants.FILE_STATUS.FAILED,
        );
        return;
      }
      throw new Error(`Error in uploading source file: ${err.message}`);
    }
  }

  publishUpdateFileStatusEvent(fileId: string, details: string, dirSize: number, status: string) {
    try {
      let updateFileStatusEvent = this.buildUpdateFileStatusEventModel(fileId, details, dirSize, status);
      this.rabbitMqService.publish(
        AppConfigService.appConfig.RABBIT_MQ_VIDEO_TOUCH_TOPIC_EXCHANGE,
        AppConfigService.appConfig.RABBIT_MQ_UPDATE_FILE_STATUS_ROUTING_KEY,
        updateFileStatusEvent,
      );
    } catch (e) {
      console.log('error while publishing update file status event', e);
    }
  }

  buildUpdateFileStatusEventModel(
    fileId: string,
    details: string,
    dirSize: number,
    status: string,
  ): Models.UpdateFileStatusEventModel {
    return {
      file_id: fileId,
      details: details,
      dir_size: dirSize,
      status: status,
    };
  }
}
