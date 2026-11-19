import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
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

  async transcodeVideoByResolution(videoId: string, height: number, width: number) {
    let result = null;
    try {
      let inputFilePath = await this.getSourceVideoInput(videoId);
      // Created here, not by getLocalResolutionPath (non-recursive): alone in a container, the asset folder is new.
      let assetFolderPath = Utils.getLocalVideoRootPath(videoId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
      let outputFolderPath = `${assetFolderPath}/${height}`;
      fs.mkdirSync(outputFolderPath, { recursive: true });
      result = await this.transcodeVideo(inputFilePath, outputFolderPath, height, width);
    } catch (e: any) {
      throw new Error(e);
    }

    return result;
  }

  /** The rendition's local playlist ({TEMP}/<id>/<height>/<height>_out.m3u8), the MP4's input. */
  getLocalPlaylistPath(videoId: string, height: number): string {
    let assetFolderPath = Utils.getLocalVideoRootPath(videoId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY);
    return `${assetFolderPath}/${height}/${Utils.getFileName(height)}`;
  }

  /** Where the downloadable MP4 is written ({TEMP}/<id>/<name>). */
  getLocalDownloadFilePath(videoId: string, name: string): string {
    return `${Utils.getLocalVideoRootPath(videoId, AppConfigService.appConfig.TEMP_VIDEO_DIRECTORY)}/${name}`;
  }

  async createMp4FromM3u8ByResolution(videoId: string, height: number, name: string) {
    let result = null;
    try {
      let masterPlaylistPath = this.getLocalPlaylistPath(videoId, height);
      let outputPath = this.getLocalDownloadFilePath(videoId, name);
      // Created recursively: alone in a container, the asset folder may not exist yet.
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      result = await this.createMp4FromM3u8(masterPlaylistPath, outputPath);
    } catch (e: any) {
      throw new Error(e);
    }

    return result;
  }
}
