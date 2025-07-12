import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { HeightWidthMap } from '@/src/api/assets/models/file.model';
import { FileDocument } from '@/src/api/assets/schemas/files.schema';
import { Models } from 'video-touch-common';
import { JobMetadataModel } from 'video-touch-common/dist/models';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class JobManagerService {
  constructor(
    @InjectQueue('process_video_360p') private videoProcessQueue360p: Queue,
    @InjectQueue('process_video_480p') private videoProcessQueue480p: Queue,
    @InjectQueue('process_video_540p') private videoProcessQueue540p: Queue,
    @InjectQueue('process_video_720p') private videoProcessQueue720p: Queue,
    @InjectQueue('thumbnail-generation') private thumbnailGenerationQueue: Queue
  ) {}

  getHeightWidthMap(): HeightWidthMap[] {
    return [
      {
        height: 720,
        width: 1280,
      },
      {
        height: 540,
        width: 960,
      },
      {
        height: 480,
        width: 854,
      },
      {
        height: 360,
        width: 640,
      },
    ];
  }

  getHeightWiseQueueName(height: number) {
    switch (height) {
      case 720:
        return AppConfigService.appConfig.BULL_720P_PROCESS_VIDEO_JOB_QUEUE;
      case 540:
        return AppConfigService.appConfig.BULL_540P_PROCESS_VIDEO_JOB_QUEUE;
      case 480:
        return AppConfigService.appConfig.BULL_480P_PROCESS_VIDEO_JOB_QUEUE;
      case 360:
        return AppConfigService.appConfig.BULL_360P_PROCESS_VIDEO_JOB_QUEUE;
      default:
        return AppConfigService.appConfig.BULL_360P_PROCESS_VIDEO_JOB_QUEUE;
    }
  }

  getJobsData(assetId: string, files: FileDocument[]): Models.JobMetadataModel[] {
    let jobModels: Models.JobMetadataModel[] = [];
    for (let file of files) {
      jobModels.push({
        asset_id: assetId,
        file_id: file._id.toString(),
        height: file.height,
        width: file.width,
        processRoutingKey: this.getHeightWiseQueueName(file.height),
      });
    }
    return jobModels;
  }

  getJobData(file: FileDocument): Models.JobMetadataModel {
    return {
      asset_id: file.asset_id.toString(),
      file_id: file._id.toString(),
      height: file.height,
      width: file.width,
      processRoutingKey: this.getHeightWiseQueueName(file.height),
    };
  }

  getAllHeightWidthMapByHeight(height: number) {
    return this.getHeightWidthMap().filter((data) => data.height <= height);
  }

  getJobDataByHeight(height: number) {
    return this.getHeightWidthMap().find((data) => data.height === height);
  }

  async publishVideoProcessingJob(jobModel: JobMetadataModel) {
    console.log('publishing video processing job for ', jobModel.processRoutingKey, jobModel);
    if (jobModel.height === 360) {
      return this.videoProcessQueue360p.add(jobModel.processRoutingKey, jobModel);
    } else if (jobModel.height === 480) {
      return this.videoProcessQueue480p.add(jobModel.processRoutingKey, jobModel);
    } else if (jobModel.height === 540) {
      return this.videoProcessQueue540p.add(jobModel.processRoutingKey, jobModel);
    } else if (jobModel.height === 720) {
      return this.videoProcessQueue720p.add(jobModel.processRoutingKey, jobModel);
    }
    return null;
  }

  publishThumbnailGenerationJob(file: FileDocument) {
    let thumbnailGenerationJob: Models.ThumbnailGenerationJobModel = {
      asset_id: file.asset_id.toString(),
      file_id: file._id.toString(),
    };
    return this.thumbnailGenerationQueue.add(
      AppConfigService.appConfig.BULL_THUMBNAIL_GENERATION_JOB_QUEUE,
      thumbnailGenerationJob
    );
  }
}
