import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { Utils, terminal } from 'video-touch-common';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';
import { getSourceObjectKey } from '@/src/common/object-storage/object-storage-keys';

// ffmpeg keeps reading the source for the whole encode, so the URL must outlive the longest job (lock: 1 h).
const SOURCE_URL_EXPIRY_SEC = 2 * 60 * 60;

@Injectable()
export class TranscodingService {
  constructor(private objectStorageService: ObjectStorageService) {}

  async transcodeVideo(inputFilePath: string, outputFolderPath: string, height: number, width: number) {
    // Input quoted: a signed URL contains '&', which the shell would otherwise treat as a command separator.
    let command = `ffmpeg -i "${inputFilePath}" -c:v libx264 -profile:v high -level 4.0 -crf 28 -c:a aac -b:a 128k -s ${width}x${height} -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFolderPath}/${height}_out.m3u8`;
    //let command = `ffmpeg -i ${inputFilePath} -profile:v baseline -level 3.0 -s ${width}x${height} -start_number 0 -hls_time 10 -hls_list_size 0 -f hls ${outputFolderPath}/${height}_out.m3u8`;
    console.log('starting transcoding.... ', height);
    return terminal(command);
  }

  async createMp4FromM3u8(masterPlaylistPath: string, outputPath: string) {
    // Using ffmpeg to convert local HLS stream to MP4. Paths quoted: the file name comes from the asset.
    const command = `ffmpeg -y -i "${masterPlaylistPath}" -c copy "${outputPath}"`;
    console.log('starting local m3u8 to mp4 conversion....');
    return terminal(command);
  }

  /** Where ffmpeg reads the source: a signed URL to the bucket copy written by download-video-worker. */
  async getSourceVideoInput(assetId: string): Promise<string> {
    return this.objectStorageService.getSignedReadUrl(getSourceObjectKey(assetId), SOURCE_URL_EXPIRY_SEC);
  }

  async transcodeVideoByResolution(videoId: string, height: number, width: number) {
    let result = null;
    try {
      let inputFilePath = await this.getSourceVideoInput(videoId);
      // Created recursively: this container's scratch folder has no asset folder yet.
      let outputFolderPath = this.getLocalRenditionDir(videoId, height);
      fs.mkdirSync(outputFolderPath, { recursive: true });
      result = await this.transcodeVideo(inputFilePath, outputFolderPath, height, width);
    } catch (e: any) {
      throw new Error(e);
    }

    return result;
  }

  /** The transcoder's output folder for one rendition ({TEMP}/<id>/<height>). */
  getLocalRenditionDir(videoId: string, height: number): string {
    return `${this.getLocalAssetDir(videoId)}/${height}`;
  }

  /**
   * Where the mp4 step downloads a rendition ({TEMP}/<id>/mp4-<height>). Separate from the transcoder's folder:
   * with WORKER_ROLE=all a transcode and an mp4 job for the same asset can run in one process.
   */
  getLocalMp4RenditionDir(videoId: string, height: number): string {
    return `${this.getLocalAssetDir(videoId)}/mp4-${height}`;
  }

  /** Where the downloadable MP4 is written ({TEMP}/<id>/<name>). */
  getLocalDownloadFilePath(videoId: string, name: string): string {
    return `${this.getLocalAssetDir(videoId)}/${name}`;
  }

  /**
   * Deletes one scratch file or folder this job created. Never the whole asset folder: another job in the same
   * process may still be using it. A failed delete is logged, not thrown, so it can't fail a finished job.
   */
  removeLocalPath(localPath: string) {
    try {
      fs.rmSync(localPath, { recursive: true, force: true });
      console.log('scratch removed:', localPath);
    } catch (e) {
      console.log('error while removing scratch', localPath, e);
    }
  }

  private getLocalAssetDir(videoId: string): string {
    return Utils.getLocalVideoRootPath(videoId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
  }
}
