import { Controller, Post } from '@nestjs/common';
import { CleanupService } from '../services/cleanup.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('cronjob')
@Controller({ version: '1', path: 'cron-jobs' })
export class CronjobController {
  constructor(private readonly cleanupService: CleanupService) {}

  @Post('cleanup-device')
  @ApiOperation({ summary: 'Cleanup temporary video files' })
  @ApiResponse({
    status: 200,
    description: 'Successfully cleaned up temporary files',
  })
  async cleanup() {
    await this.cleanupService.cleanupDevice();
    return { message: 'Cleanup completed successfully' };
  }
}
