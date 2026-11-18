import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard } from '@/src/api/sla/guards/internal-api-key.guard';
import { ProcessorBacklogService } from '@/src/api/assets/services/processor-backlog.service';

@ApiTags('processors')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller({ version: '1', path: 'processors' })
export class ProcessorController {
  constructor(private processorBacklogService: ProcessorBacklogService) {}

  @Get('backlog')
  @ApiOperation({ summary: 'Queue backlog and wanted replica count per worker pool. Polled by autoscalers.' })
  @ApiQuery({ name: 'pool', required: false, description: 'One pool, e.g. transcode-720p. Omit for all pools.' })
  async getBacklog(@Query('pool') pool?: string) {
    if (pool) {
      return this.processorBacklogService.getBacklog(pool);
    }
    return { pools: await this.processorBacklogService.getAllBacklogs() };
  }
}
