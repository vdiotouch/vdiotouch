import { Global, Module } from '@nestjs/common';
import { ObjectStorageService } from '@/src/common/object-storage/object-storage.service';

@Global()
@Module({
  providers: [ObjectStorageService],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}
