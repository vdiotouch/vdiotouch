import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';
import { ProcessorBacklogService } from '@/src/api/assets/services/processor-backlog.service';

// Several jobs added to one pool within this window (e.g. N transcript chunks) send a single webhook.
const NOTIFY_COALESCE_WINDOW_MS = 1000;

/**
 * Optional push to an autoscaler (SCALE_WEBHOOK_URL) whenever this api adds a job to a pool's queue,
 * so replicas start in about a second instead of waiting for the autoscaler's next poll.
 * Jobs that workers add themselves (e.g. upload jobs) are not seen here; the autoscaler's poll covers them.
 * Failures are logged and never block the job add.
 */
@Injectable()
export class ScaleWebhookService implements OnModuleInit {
  private pendingPools = new Set<string>();

  constructor(private httpService: HttpService, private processorBacklogService: ProcessorBacklogService) {}

  onModuleInit() {
    if (!AppConfigService.appConfig.SCALE_WEBHOOK_URL) {
      console.log('SCALE_WEBHOOK_URL is not set, scale webhook disabled');
      return;
    }
    for (const pool of this.processorBacklogService.getPools()) {
      for (const queue of pool.queues) {
        // BullMQ emits 'waiting' on the Queue instance right after queue.add() succeeds.
        queue.on('waiting', () => this.scheduleNotify(pool.name));
      }
    }
  }

  private scheduleNotify(poolName: string) {
    if (this.pendingPools.has(poolName)) {
      return;
    }
    this.pendingPools.add(poolName);
    setTimeout(() => {
      this.pendingPools.delete(poolName);
      void this.notify(poolName);
    }, NOTIFY_COALESCE_WINDOW_MS);
  }

  private async notify(poolName: string) {
    try {
      await firstValueFrom(
        this.httpService.post(
          AppConfigService.appConfig.SCALE_WEBHOOK_URL,
          { pool: poolName },
          {
            timeout: 5000,
            headers: { Authorization: `Bearer ${AppConfigService.appConfig.SCALE_WEBHOOK_TOKEN}` },
          }
        )
      );
    } catch (err: any) {
      console.log(`scale webhook failed for pool ${poolName}:`, err?.message);
    }
  }
}
