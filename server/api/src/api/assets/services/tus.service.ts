import { Injectable, Req, Res } from '@nestjs/common';
import { Server } from '@tus/server';
import { Request, Response } from 'express';

/**
 * tus resumable upload. Switched off since commit 94bb398 and there is no upload screen yet, so `tusServer` is
 * never created and /upload/files does not work. The old setup wrote uploads to a shared disk, which no longer
 * exists: when this comes back, store the upload in the bucket at getSourceObjectKey(assetId)
 * (object-storage-keys.ts), then set the asset UPLOADED, so validate / thumbnail / transcode read it from there.
 */
@Injectable()
export class TusService {
  private tusServer: Server;

  async handleTus(@Req() req: Request, @Res() res: Response) {
    return this.tusServer.handle(req, res);
  }
}
