import { S3ClientService } from '@/src/common/aws/s3/s3-client.service';
import { RabbitMqService } from '@/src/common/rabbit-mq/service/rabbitmq.service';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { Constants, Models, terminal, Utils } from 'video-touch-common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import * as process from 'node:process';
import * as console from 'node:console';
import { Job } from 'bullmq';

@Processor(process.env.BULL_UPLOAD_JOB_QUEUE)
export class VideoUploaderJobHandler extends WorkerHost {
  constructor(
    private s3ClientService: S3ClientService,
    private rabbitMqService: RabbitMqService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    let msg: Models.VideoUploadJobModel = job.data as Models.VideoUploadJobModel;
    console.log(`uploading ${msg.height}p video`, msg.asset_id.toString());
    await this.upload(msg);
  }

  async syncDirToS3(localDir: string, s3Dir: string) {
    console.log('syncing dir to s3', localDir, s3Dir);

    let command = `aws s3 sync ${localDir}  ${s3Dir}`;
    if (AppConfigService.appConfig.AWS_PROFILE_NAME) {
      command += ` --profile ${AppConfigService.appConfig.AWS_PROFILE_NAME}`;
    }
    return terminal(command);
  }

  async upload(msg: Models.VideoUploadJobModel) {
    try {
      let localFilePath = Utils.getLocalResolutionPath(
        msg.asset_id.toString(),
        msg.height,
        AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY,
      );
      let s3VideoPath = Utils.getS3VideoPath(
        msg.asset_id.toString(),
        msg.height,
        AppConfigService.appConfig.AWS_S3_BUCKET_NAME,
      );
      let res = await this.syncDirToS3(localFilePath, s3VideoPath);
      console.log(`video ${msg.height}p uploaded:`, res);

      await this.s3ClientService.syncMainManifestFile(msg.asset_id.toString());

      let dirSize = await Utils.getDirSize(localFilePath);
      console.log('dir size:', dirSize);

      this.publishUpdateFileStatusEvent(msg.file_id.toString(), 'File uploaded', dirSize, Constants.FILE_STATUS.READY);
    } catch (err: any) {
      console.log('error in uploading ', msg.height, err);

      this.publishUpdateFileStatusEvent(
        msg.file_id.toString(),
        'File uploading failed',
        0,
        Constants.FILE_STATUS.FAILED,
      );
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
