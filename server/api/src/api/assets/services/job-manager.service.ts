import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { HeightWidthMap } from '@/src/api/assets/models/file.model';
import { FileDocument } from '@/src/api/assets/schemas/files.schema';
import { Models } from 'video-touch-common';

@Injectable()
export class JobManagerService {
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

  getJobData(assetId: string, files: FileDocument[]): Models.JobMetadataModel[] {
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

  getAllHeightWidthMapByHeight(height: number) {
    return this.getHeightWidthMap().filter((data) => data.height <= height);
  }

  getJobDataByHeight(height: number) {
    return this.getHeightWidthMap().find((data) => data.height === height);
  }
}
