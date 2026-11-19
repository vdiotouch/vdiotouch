import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { terminal, Utils } from 'video-touch-common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import {
  getAudioChunkObjectKey,
  getAudioChunksPrefix,
  getPartialTranscriptObjectKey,
  getSourceObjectKey,
} from '@/src/common/object-storage/object-storage-keys';

// ffmpeg keeps reading the source for the whole extraction, so the URL must outlive the longest job (lock: 1 h).
const SOURCE_URL_EXPIRY_SEC = 2 * 60 * 60;

/**
 * The bucket side of the audio pipeline, so extraction, transcription and merge need no shared disk.
 * Every method except isEnabled() / getSourceVideoInput() needs object storage enabled (not bunny).
 */
@Injectable()
export class AudioStorageService {
  constructor(private objectStorageService: ObjectStorageService) {}

  isEnabled(): boolean {
    return this.objectStorageService.isEnabled();
  }

  /**
   * Where ffmpeg reads the source: a signed URL to the bucket copy (stateless), or the shared temp disk when
   * object storage is off (bunny) or the asset was downloaded before the bucket copy existed.
   */
  async getSourceVideoInput(assetId: string): Promise<string> {
    let sourceKey = getSourceObjectKey(assetId);
    if (this.objectStorageService.isEnabled() && (await this.objectStorageService.exists(sourceKey))) {
      return this.objectStorageService.getSignedReadUrl(sourceKey, SOURCE_URL_EXPIRY_SEC);
    }
    return Utils.getLocalVideoMp4Path(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
  }

  /**
   * Splits the mp3 like the api's splitAudio did (same command, same 000.mp3… names) and uploads every chunk.
   * Runs before AUDIO READY: the api creates the PARTIAL_TRANSCRIPT rows by listing these chunk keys.
   */
  async splitAndUploadChunks(assetId: string, mp3Path: string): Promise<number> {
    let chunksDir = Utils.getLocalAudioChunksDir(assetId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
    // Start clean on a retry: ffmpeg won't overwrite without -y, and stale chunks would be listed by the api.
    fs.rmSync(chunksDir, { recursive: true, force: true });
    fs.mkdirSync(chunksDir, { recursive: true });
    await this.objectStorageService.deletePrefix(getAudioChunksPrefix(assetId));

    console.log(`Splitting audio file ${mp3Path} into directory ${chunksDir}/`);
    // Paths quoted like the source input; segment length must match the api's start-time math.
    const command = `ffmpeg -i "${mp3Path}" -f segment -segment_time ${AppConfigService.appConfig.AUDIO_CHUNK_DURATION_IN_SEC} -c copy "${chunksDir}/%03d.mp3"`;
    await terminal(command);

    let chunkNames = fs.readdirSync(chunksDir).sort();
    for (let chunkName of chunkNames) {
      await this.objectStorageService.uploadFile(
        getAudioChunkObjectKey(assetId, chunkName),
        `${chunksDir}/${chunkName}`,
      );
    }
    console.log(`audio of asset ${assetId} split into ${chunkNames.length} chunks`);
    return chunkNames.length;
  }

  /** Uploads the extracted mp3 to its playback path. Returns its size in bytes, reported on the READY event. */
  async uploadAudio(assetId: string, name: string, localPath: string): Promise<number> {
    await this.objectStorageService.uploadFile(Utils.getServerAudioFilePath(assetId, name), localPath);
    return fs.statSync(localPath).size;
  }

  async downloadChunk(assetId: string, chunkName: string, localPath: string): Promise<void> {
    await this.objectStorageService.downloadFile(getAudioChunkObjectKey(assetId, chunkName), localPath);
  }

  async uploadPartialTranscript(assetId: string, transcriptName: string, localPath: string): Promise<void> {
    await this.objectStorageService.uploadFile(getPartialTranscriptObjectKey(assetId, transcriptName), localPath);
  }

  /** Downloads the partials into localDir. A missing one is skipped, as the merge already skips missing files. */
  async downloadPartialTranscripts(assetId: string, transcriptNames: string[], localDir: string): Promise<void> {
    for (let transcriptName of transcriptNames) {
      let key = getPartialTranscriptObjectKey(assetId, transcriptName);
      if (!(await this.objectStorageService.exists(key))) {
        console.warn(`Partial transcript not found in bucket: ${key}`);
        continue;
      }
      await this.objectStorageService.downloadFile(key, `${localDir}/${transcriptName}`);
    }
  }

  /** Uploads the merged transcript to its playback path. Returns its size in bytes, reported on the READY event. */
  async uploadTranscript(assetId: string, name: string, localPath: string): Promise<number> {
    await this.objectStorageService.uploadFile(Utils.getServerTranscriptFilePath(assetId, name), localPath);
    return fs.statSync(localPath).size;
  }
}
