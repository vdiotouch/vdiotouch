import { Injectable, OnModuleInit } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { resolveObjectStorageConfig } from '@/src/common/object-storage/object-storage-config';
import { contentTypeForKey, PLAYLIST_EXTENSION } from '@/src/common/object-storage/content-types';

const DEFAULT_SIGNED_URL_EXPIRY_SEC = 60 * 60;
// S3 DeleteObjects accepts at most 1000 keys per call.
const DELETE_BATCH_SIZE = 1000;

/**
 * The bucket every service shares instead of a local disk: S3 API, so it works with R2, AWS S3 and other
 * S3-compatible stores (see object-storage-config.ts). Keys are bucket paths, e.g. "sources/<asset_id>/source.mp4".
 * Disabled (every call throws) when STORAGE_PROVIDER is not s3 or r2, so a misconfiguration fails the job.
 */
@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private client: S3Client | null = null;
  private bucket = '';

  onModuleInit() {
    const config = resolveObjectStorageConfig(AppConfigService.appConfig);
    if (!config) {
      console.log(
        `object storage disabled: STORAGE_PROVIDER ${AppConfigService.appConfig.STORAGE_PROVIDER} has no S3 API`
      );
      return;
    }
    this.client = new S3Client(config.clientConfig);
    this.bucket = config.bucket;
  }

  /** True when STORAGE_PROVIDER has an S3 API (s3 / r2), i.e. services can share files through the bucket. */
  isEnabled(): boolean {
    return this.client !== null;
  }

  /** Uploads a local file. Large files go up as a multipart upload. */
  async uploadFile(key: string, localPath: string, contentType: string = contentTypeForKey(key)): Promise<void> {
    await this.uploadStream(key, fs.createReadStream(localPath), contentType);
  }

  /** Uploads a stream of unknown length (e.g. an HTTP download) without buffering it in memory. */
  async uploadStream(key: string, body: Readable, contentType: string = contentTypeForKey(key)): Promise<void> {
    const upload = new Upload({
      client: this.getClient(),
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: contentType },
    });
    await upload.done();
    console.log(`[object-storage] uploaded ${key}`);
  }

  /**
   * Uploads every file under localDir to <prefix>/<relative path>. Playlists go last, so a player never
   * sees a playlist before the segments it points to. Returns the number of files uploaded.
   */
  async uploadDirectory(localDir: string, prefix: string): Promise<number> {
    const files = this.listLocalFiles(localDir);
    const segments = files.filter((file) => path.extname(file) !== PLAYLIST_EXTENSION);
    const playlists = files.filter((file) => path.extname(file) === PLAYLIST_EXTENSION);
    for (const file of [...segments, ...playlists]) {
      const key = path.posix.join(prefix, path.relative(localDir, file).split(path.sep).join('/'));
      await this.uploadFile(key, file);
    }
    return files.length;
  }

  /** Downloads an object to a local file, creating its directory. */
  async downloadFile(key: string, localPath: string): Promise<void> {
    const response = await this.getClient().send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    await pipeline(response.Body as Readable, fs.createWriteStream(localPath));
    console.log(`[object-storage] downloaded ${key} -> ${localPath}`);
  }

  /** Copies an object inside the bucket. Streams through this process, so S3's 5 GB CopyObject limit doesn't apply. */
  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const response = await this.getClient().send(new GetObjectCommand({ Bucket: this.bucket, Key: sourceKey }));
    await this.uploadStream(destinationKey, response.Body as Readable);
  }

  /** Time-limited GET URL, e.g. for ffprobe / ffmpeg to read an object without downloading it first. */
  async getSignedReadUrl(key: string, expiresInSec: number = DEFAULT_SIGNED_URL_EXPIRY_SEC): Promise<string> {
    return getSignedUrl(this.getClient(), new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSec,
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.getClient().send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (err instanceof NotFound) {
        return false;
      }
      throw err;
    }
  }

  /** Every key under prefix (end it with "/" for a folder), e.g. the chunks of an audio file. */
  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const page = await this.getClient().send(command);
      keys.push(...(page.Contents ?? []).map((object) => object.Key as string));
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }

  /** Downloads every object under prefix into localDir, keeping paths relative to prefix. Returns the file count. */
  async downloadPrefix(prefix: string, localDir: string): Promise<number> {
    const keys = await this.listKeys(prefix);
    for (const key of keys) {
      await this.downloadFile(key, path.join(localDir, key.slice(prefix.length)));
    }
    return keys.length;
  }

  /** Deletes every object whose key starts with prefix. Returns the number of objects deleted. */
  async deletePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    let continuationToken: string | undefined;
    do {
      const page = await this.getClient().send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: DELETE_BATCH_SIZE,
        })
      );
      const keys = (page.Contents ?? []).map((object) => ({ Key: object.Key }));
      if (keys.length) {
        await this.getClient().send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } })
        );
        deleted += keys.length;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    console.log(`[object-storage] deleted ${deleted} objects under ${prefix}`);
    return deleted;
  }

  private getClient(): S3Client {
    if (!this.client) {
      throw new Error(
        `object storage is not available for STORAGE_PROVIDER ${AppConfigService.appConfig.STORAGE_PROVIDER}; use s3 or r2`
      );
    }
    return this.client;
  }

  private listLocalFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? this.listLocalFiles(fullPath) : [fullPath];
    });
  }
}
