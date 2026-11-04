import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'node:fs';

/**
 * Storage providers are inconsistent about the Content-Type they stamp on an uploaded mp3, so
 * this accepts the generic binary types and a missing header too, rather than hard-failing the
 * way the download worker's downloadVideo does on anything that is not exactly video/mp4.
 */
const ALLOWED_CONTENT_TYPE_PREFIXES = ['audio/', 'application/octet-stream', 'binary/octet-stream'];

@Injectable()
export class AudioDownloadService {
  async download(audioUrl: string, destinationPath: string): Promise<string> {
    console.log(`downloading audio from ${audioUrl} to ${destinationPath}`);
    const response = await axios.get(audioUrl, { responseType: 'stream' });

    const contentType = (response.headers['content-type'] || '').toString().toLowerCase();
    if (contentType && !ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) => contentType.startsWith(prefix))) {
      throw new Error(`Unexpected content type for audio file: ${contentType}`);
    }

    const writer = fs.createWriteStream(destinationPath, { flags: 'w' });
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('audio downloaded successfully');
        resolve(destinationPath);
      });
      writer.on('error', reject);
      response.data.on('error', reject);
    });
  }
}
