import { Injectable } from '@nestjs/common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import mongoose from 'mongoose';
import { JobManagerService } from '@/src/api/assets/services/job-manager.service';
import { FileDocument } from '@/src/api/assets/schemas/files.schema';
import { Constants } from 'video-touch-common';

@Injectable()
export class TranscriptService {
  constructor(private fileRepository: FileRepository, private jobManagerService: JobManagerService) {}

  async generateTranscript(assetId: string, transcriptFile: FileDocument, force: boolean = false) {
    let partialTranscriptFiles = await this.fileRepository.find({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: Constants.FILE_TYPE.PARTIAL_TRANSCRIPT,
    });
    if (partialTranscriptFiles.length === 0) {
      throw new Error('No partial transcript files found for this asset');
    }
    console.log('partialTranscriptFiles ', partialTranscriptFiles.length);
    if (!this.checkAllPartialTranscriptsReady(partialTranscriptFiles)) {
      throw new Error('Not all partial transcript files are ready');
    }

    if (!force) {
      let claimed = await this.claimMerge(transcriptFile);
      if (!claimed) {
        console.log('merge already claimed for transcript file ', transcriptFile._id.toString());
        return;
      }
    }

    // Sort files by name to ensure correct order (e.g., transcript_0.json, transcript_1.json, etc.)
    partialTranscriptFiles.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    let jobData = await this.jobManagerService.publishTranscriptMergingJob(
      assetId,
      transcriptFile,
      partialTranscriptFiles
    );
    await this.fileRepository.findOneAndUpdate(
      {
        _id: transcriptFile._id,
      },
      {
        job_id: jobData.id,
      }
    );
  }

  /**
   * Every partial going READY re-runs the all-ready check, so chunks finishing together would
   * each publish a merge job. findOneAndUpdate is atomic: only the caller that flips the flag
   * gets a document back, and the rest bail out.
   *
   * Claims on meta rather than job_id — job_id already holds the audio-split job id by this
   * point, having been set when the transcript file was saved.
   */
  private async claimMerge(transcriptFile: FileDocument): Promise<boolean> {
    let claimed = await this.fileRepository.findOneAndUpdate(
      {
        _id: transcriptFile._id,
        'meta.merge_claimed': { $ne: true },
      },
      {
        $set: { 'meta.merge_claimed': true },
      }
    );
    return !!claimed;
  }

  private checkAllPartialTranscriptsReady(partialTranscriptFiles: FileDocument[]): boolean {
    return partialTranscriptFiles.every((file) => file.latest_status === Constants.FILE_STATUS.READY);
  }

  async generateTranscriptByPartialTranscriptFile(partialTranscriptFile: FileDocument) {
    let transcriptFile = await this.fileRepository.findOne({
      asset_id: partialTranscriptFile.asset_id,
      type: Constants.FILE_TYPE.TRANSCRIPT,
    });
    if (!transcriptFile) {
      throw new Error('Transcript file does not exist for this asset');
    }
    return this.generateTranscript(transcriptFile.asset_id.toString(), transcriptFile);
  }
}
