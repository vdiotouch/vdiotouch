import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { terminal } from 'video-touch-common';

@Injectable()
export class AudioExtractionService {
  constructor() {}

  /** inputFilePath is a signed URL to the source (see AudioStorageService.getSourceVideoInput). */
  async extractAudio(inputFilePath: string, outputFolderPath: string) {
    // Created here: this container's scratch folder for the asset may not exist yet.
    fs.mkdirSync(outputFolderPath, { recursive: true });
    // Output file path (e\.g\. audio.m4a)
    const outputAudioPath = `${outputFolderPath}/audio.m4a`;
    // ffmpeg command for minimal size: mono channel, low bitrate.
    // Input quoted: a signed URL contains '&', which the shell would otherwise treat as a command separator.
    const command = `ffmpeg -y -i "${inputFilePath}" -vn -ar 44100 -ac 1 -b:a 64k ${outputAudioPath.replace('.m4a', '.mp3')}`;
    console.log('Extracting audio with minimal size...');
    return terminal(command);
  }
}
