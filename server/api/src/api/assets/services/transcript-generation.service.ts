import { Injectable } from '@nestjs/common';
import fs from 'fs';
import mongoose from 'mongoose';
import { Constants, Utils } from 'video-touch-common';
import { FileRepository } from '@/src/api/assets/repositories/file.repository';
import { FileMapper } from '@/src/api/assets/mapper/file.mapper';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

/**
 * Owns the Mongo side of a transcript run. The audio download and the ffmpeg split live in
 * audio-worker; this service only creates the rows whose save hooks schedule that work.
 *
 * Deliberately does not inject FileService: FileService already injects TranscriptService, and
 * pulling it in here would need a forwardRef to break the cycle.
 */
@Injectable()
export class TranscriptGenerationService {
  constructor(private fileRepository: FileRepository) {}

  /**
   * Creating this row is what schedules the split job — see FileService.afterSave. Everything
   * after it is driven by hooks, so callers do not need to background any work themselves.
   */
  async createTranscriptFile(assetId: string) {
    let fileToBeSaved = FileMapper.mapForSave(
      assetId,
      Utils.getTranscriptFileName(),
      Constants.FILE_TYPE.TRANSCRIPT,
      0,
      0,
      Constants.FILE_STATUS.QUEUED,
      'Transcription file queued for processing',
      0
    );
    return this.fileRepository.create(fileToBeSaved);
  }

  /** Drops previous transcript artifacts so a re-run cannot merge stale chunks. */
  async resetTranscriptFiles(assetId: string) {
    // deleteMany fires no Mongoose hook, so this schedules nothing
    await this.fileRepository.deleteMany({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: { $in: [Constants.FILE_TYPE.TRANSCRIPT, Constants.FILE_TYPE.PARTIAL_TRANSCRIPT] },
    });

    let transcriptsDir = Utils.getLocalPartialTranscriptsDir(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
    fs.rmSync(transcriptsDir, { recursive: true, force: true });
  }

  /**
   * Chunk names come off the shared temp volume rather than the split job's reply: audio-worker's
   * only outbound routing key is update.file.status, so it cannot carry a chunk list, and the API
   * has always read this directory itself.
   */
  readChunkNames(assetId: string): string[] {
    let chunksDir = Utils.getLocalAudioChunksDir(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
    return fs.readdirSync(chunksDir).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
  }

  /**
   * Saving each row publishes its transcription job. The TRANSCRIPT row these merge into must
   * already exist — a chunk that finishes before it does fails its merge lookup and is lost.
   */
  async createPartialTranscriptFiles(assetId: string, chunkNames: string[]) {
    let startTimeSeconds = 0;
    for (let i = 0; i < chunkNames.length; i++) {
      await this.createPartialTranscriptFile(
        assetId,
        `transcript_${i}.json`,
        chunkNames[i],
        this.formatSecondsToHHMMSS(startTimeSeconds)
      );
      startTimeSeconds += AppConfigService.appConfig.AUDIO_CHUNK_DURATION_IN_SEC;
      console.log(`Created transcription file for chunk: ${chunkNames[i]}`);
    }
  }

  async createPartialTranscriptFile(
    assetId: string,
    transcriptFileName: string,
    audioFileName: string,
    audioStartTime: string
  ) {
    let fileToBeSaved = FileMapper.mapForSave(
      assetId,
      transcriptFileName,
      Constants.FILE_TYPE.PARTIAL_TRANSCRIPT,
      0,
      0,
      Constants.FILE_STATUS.QUEUED,
      'Transcription file queued for processing',
      0,
      {
        audio_start_time: audioStartTime,
        audio_file_name: audioFileName,
      }
    );
    return this.fileRepository.create(fileToBeSaved);
  }

  async hasPartialTranscripts(assetId: string): Promise<boolean> {
    let count = await this.fileRepository.count({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: Constants.FILE_TYPE.PARTIAL_TRANSCRIPT,
    });
    return count > 0;
  }

  /** A run is in flight while any chunk is still queued or being transcribed. */
  async hasRunInFlight(assetId: string): Promise<boolean> {
    let count = await this.fileRepository.count({
      asset_id: mongoose.Types.ObjectId(assetId),
      type: { $in: [Constants.FILE_TYPE.TRANSCRIPT, Constants.FILE_TYPE.PARTIAL_TRANSCRIPT] },
      latest_status: { $in: [Constants.FILE_STATUS.QUEUED, Constants.FILE_STATUS.PROCESSING] },
    });
    return count > 0;
  }

  formatSecondsToHHMMSS(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [hours, minutes, secs].map((unit) => unit.toString().padStart(2, '0')).join(':');
  }
}
