import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { WorkerHost } from '@nestjs/bullmq';
import { Worker } from 'bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

const IDLE_CHECK_INTERVAL_MS = 10 * 1000;

/**
 * Stops this process after WORKER_IDLE_EXIT_SEC seconds without an active job, so a platform that runs one
 * container per replica (Cloudflare Containers) gets the replica back when the queue is empty.
 * Empty or 0 = never exit (docker-compose, Kubernetes).
 * It sends SIGTERM to itself, so it takes the same graceful shutdown path as a platform stop.
 */
@Injectable()
export class WorkerIdleExitService implements OnApplicationBootstrap, OnApplicationShutdown {
  private activeJobs = 0;
  private lastActivityAt = Date.now();
  private timer: NodeJS.Timeout | null = null;

  constructor(private discoveryService: DiscoveryService) {}

  // Bull workers are created in onModuleInit, so they exist by now.
  onApplicationBootstrap() {
    const idleExitSec = AppConfigService.appConfig.WORKER_IDLE_EXIT_SEC;
    if (!idleExitSec) {
      return;
    }
    for (const worker of this.findBullWorkers()) {
      worker.on('active', () => this.onJobStarted());
      worker.on('completed', () => this.onJobFinished());
      worker.on('failed', () => this.onJobFinished());
    }
    this.timer = setInterval(() => this.exitIfIdle(idleExitSec), IDLE_CHECK_INTERVAL_MS);
    console.log(`idle exit enabled: process exits after ${idleExitSec}s without an active job`);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private findBullWorkers(): Worker[] {
    return this.discoveryService
      .getProviders()
      .map((wrapper) => wrapper.instance)
      .filter((instance): instance is WorkerHost => instance instanceof WorkerHost)
      .map((host) => host.worker);
  }

  private onJobStarted() {
    this.activeJobs++;
    this.lastActivityAt = Date.now();
  }

  private onJobFinished() {
    this.activeJobs = Math.max(0, this.activeJobs - 1);
    this.lastActivityAt = Date.now();
  }

  private exitIfIdle(idleExitSec: number) {
    const idleMs = Date.now() - this.lastActivityAt;
    if (this.activeJobs > 0 || idleMs < idleExitSec * 1000) {
      return;
    }
    console.log(`no active job for ${Math.round(idleMs / 1000)}s, shutting down`);
    clearInterval(this.timer);
    this.timer = null;
    process.kill(process.pid, 'SIGTERM');
  }
}
