import { Injectable } from '@nestjs/common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { Constants, Models } from 'video-touch-common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobManagerService } from './job-manager.service';
import { FileDocument } from '@/src/api/assets/schemas/files.schema';

@Injectable()
export class JobVerificationService {
  constructor(
    private fileRepository: FileRepository,
    private jobManagerService: JobManagerService,
    @InjectQueue('process_video_360p') private videoProcessQueue360p: Queue,
    @InjectQueue('process_video_480p') private videoProcessQueue480p: Queue,
    @InjectQueue('process_video_540p') private videoProcessQueue540p: Queue,
    @InjectQueue('process_video_720p') private videoProcessQueue720p: Queue
  ) {}

  /**
   * Verifies and republishes jobs for files with Processing and Queued status
   * @returns Object with counts of verified and republished jobs
   */
  async verifyAndRepublishJobs(): Promise<{ verified: number; republished: number }> {
    console.log('Starting job verification and republishing process');

    let files = await this.fileRepository.findFilesByStatuses([
      Constants.FILE_STATUS.PROCESSING,
      Constants.FILE_STATUS.QUEUED,
    ]);

    console.log(`Found ${files.length} files with Processing or Queued status`);

    let verified = 0;
    let republished = 0;

    // For each file, verify if the job exists in BullMQ
    for (const file of files) {
      if (file.type === Constants.FILE_TYPE.PLAYLIST) {
        // Get the appropriate queue based on file height
        const queue = this.getQueueByHeight(file.height);
        if (!queue) {
          console.warn(`No queue found for file ${file._id} with height ${file.height}`);
          continue;
        }

        const jobExists = await this.checkJobExistsInQueue(queue, file._id.toString());
        if (!jobExists) {
          console.log(`Job for file ${file._id} does not exist in queue. Republishing...`);
          await this.republishJob(file);
          republished++;
        } else {
          console.log(`Job for file ${file._id} already exists in queue.`);
        }
      }else if (file.type === Constants.FILE_TYPE.THUMBNAIL) {

      }
    }

    console.log(`Job verification completed. Verified: ${verified}, Republished: ${republished}`);
    return { verified, republished };
  }

  /**
   * Gets the appropriate queue based on file height
   * @param height The height of the file
   * @returns The corresponding BullMQ queue
   */
  private getQueueByHeight(height: number): Queue | null {
    switch (height) {
      case 360:
        return this.videoProcessQueue360p;
      case 480:
        return this.videoProcessQueue480p;
      case 540:
        return this.videoProcessQueue540p;
      case 720:
        return this.videoProcessQueue720p;
      default:
        return null;
    }
  }

  /**
   * Checks if a job for the given file exists in the queue
   * @param queue The queue to check
   * @param fileId The ID of the file
   * @returns Boolean indicating if the job exists
   */
  private async checkJobExistsInQueue(queue: Queue, fileId: string): Promise<boolean> {
    // Get all jobs in the queue
    const jobs = await queue.getJobs(['active', 'waiting', 'delayed']);

    // Check if any job has this file ID
    return jobs.some((job) => {
      const jobData = job.data as Models.JobMetadataModel;
      return jobData.file_id === fileId;
    });
  }

  /**
   * Republishes a job for the given file
   * @param file The file document to republish
   */
  private async republishJob(file: FileDocument): Promise<void> {
    if (file.type === Constants.FILE_TYPE.PLAYLIST) {
      // Create job metadata model
      const jobModel: Models.JobMetadataModel = this.jobManagerService.getJobData(file);

      // Publish the job
      await this.jobManagerService.publishVideoProcessingJob(jobModel);
      console.log(`Republished video processing job for file ${file._id}`);
    } else if (file.type === Constants.FILE_TYPE.THUMBNAIL) {
      // Publish thumbnail generation job
      await this.jobManagerService.publishThumbnailGenerationJob(file);
      console.log(`Republished thumbnail generation job for file ${file._id}`);
    } else if (file.type === Constants.FILE_TYPE.SOURCE) {
      // Create job metadata model
      const jobModel: Models.JobMetadataModel = this.jobManagerService.getJobData(file);

      // Publish source file upload job
      await this.jobManagerService.publishSourceFileUploadJob(jobModel, file.name);
      console.log(`Republished source file upload job for file ${file._id}`);
    }
  }
}
