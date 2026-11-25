import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { WorkerHost } from '@nestjs/bullmq';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '@/src/common/app-config/service/app-config.service';

const IDLE_CHECK_INTERVAL_MS = 10 * 1000;

// Node runs as PID 1 in the container, where the kernel ignores a default-handled SIGTERM: once Nest has
// closed everything and re-sends SIGTERM to itself, any handle still open (e.g. the RabbitMQ socket) keeps
// the process (and the paid container) alive forever. No job is active on this path, so exiting is safe.
const FORCE_EXIT_AFTER_MS = 30 * 1000;

// A job tracked for longer than this is checked against Redis on every idle tick.
const RECONCILE_AFTER_MS = 60 * 1000;

// Backstop for when Redis cannot be asked: a job counted as running longer than this is dropped.
// The longest job lock (process-video) is 1 hour.
const MAX_JOB_MS = 3 * 60 * 60 * 1000;

// While jobs run, say so at most this often, so a busy worker is visible in the logs.
const BUSY_LOG_INTERVAL_MS = 10 * 60 * 1000;

interface TrackedJob {
  worker: Worker;
  jobId: string;
  startedAt: number;
}

/**
 * Stops this process after WORKER_IDLE_EXIT_SEC seconds without an active job, so a platform that runs one
 * container per replica (Cloudflare Containers) gets the replica back when the queue is empty.
 * Empty or 0 = never exit (docker-compose, Kubernetes).
 * It sends SIGTERM to itself, so it takes the same graceful shutdown path as a platform stop.
 *
 * Jobs are tracked by id, not counted: a job can end without a 'completed' or 'failed' event (e.g. it was
 * removed from Redis while running, so BullMQ only emits 'error'). Such a job is found by asking Redis
 * whether it is still active, and dropped.
 */
@Injectable()
export class WorkerIdleExitService implements OnApplicationBootstrap, OnApplicationShutdown {
  private inProgress = new Map<string, TrackedJob>();
  private lastActivityAt = Date.now();
  private lastBusyLogAt = 0;
  private checking = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private discoveryService: DiscoveryService) {}

  // Bull workers are created in onModuleInit, so they exist by now.
  onApplicationBootstrap() {
    const idleExitSec = AppConfigService.appConfig.WORKER_IDLE_EXIT_SEC;
    if (!idleExitSec) {
      return;
    }
    for (const worker of this.findBullWorkers()) {
      worker.on('active', (job) => this.onJobStarted(worker, job));
      worker.on('completed', (job) => this.onJobFinished(job));
      worker.on('failed', (job) => this.onJobFinished(job));
      worker.on('error', (err) =>
        console.log(`idle exit: worker ${worker.name} error, its jobs are re-checked:`, err?.message ?? err),
      );
    }
    this.timer = setInterval(() => void this.checkIdle(idleExitSec), IDLE_CHECK_INTERVAL_MS);
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

  private trackingKey(queueName: string, jobId: string): string {
    return `${queueName}:${jobId}`;
  }

  private onJobStarted(worker: Worker, job: Job) {
    const jobId = job.id ?? '';
    this.inProgress.set(this.trackingKey(job.queueName, jobId), { worker, jobId, startedAt: Date.now() });
    this.lastActivityAt = Date.now();
  }

  private onJobFinished(job: Job | undefined) {
    if (job?.id) {
      this.inProgress.delete(this.trackingKey(job.queueName, job.id));
    }
    this.lastActivityAt = Date.now();
  }

  private async checkIdle(idleExitSec: number) {
    // A Redis call can outlast the interval; never run two checks at once.
    if (this.checking || !this.timer) {
      return;
    }
    this.checking = true;
    try {
      await this.dropLostJobs();
      if (this.inProgress.size > 0) {
        this.logBusy();
        return;
      }
      const idleMs = Date.now() - this.lastActivityAt;
      if (idleMs >= idleExitSec * 1000) {
        this.shutDown(idleMs);
      }
    } finally {
      this.checking = false;
    }
  }

  private async dropLostJobs() {
    for (const [key, tracked] of this.inProgress) {
      const ageMs = Date.now() - tracked.startedAt;
      if (ageMs < RECONCILE_AFTER_MS) {
        continue;
      }
      if (ageMs > MAX_JOB_MS) {
        this.dropJob(key, `still counted as running after ${Math.round(ageMs / 1000)}s`);
        continue;
      }
      const state = await this.getJobState(tracked);
      if (state !== null && state !== 'active') {
        this.dropJob(key, `it is ${state} in Redis, not active`);
      }
    }
  }

  /** The job's state in Redis, 'missing' if it is gone, or null if Redis could not be asked (ask again later). */
  private async getJobState(tracked: TrackedJob): Promise<string | null> {
    try {
      const job = await Job.fromId(tracked.worker, tracked.jobId);
      return job ? await job.getState() : 'missing';
    } catch (err) {
      console.log(`idle exit: could not read job ${tracked.jobId} from Redis:`, (err as Error)?.message ?? err);
      return null;
    }
  }

  private dropJob(key: string, reason: string) {
    this.inProgress.delete(key);
    this.lastActivityAt = Date.now();
    console.log(`idle exit: stopped counting job ${key}: ${reason}`);
  }

  private logBusy() {
    if (Date.now() - this.lastBusyLogAt < BUSY_LOG_INTERVAL_MS) {
      return;
    }
    this.lastBusyLogAt = Date.now();
    console.log(`idle exit: ${this.inProgress.size} job(s) in progress:`, [...this.inProgress.keys()].join(', '));
  }

  private shutDown(idleMs: number) {
    console.log(`no active job for ${Math.round(idleMs / 1000)}s, shutting down`);
    clearInterval(this.timer);
    this.timer = null;
    // unref: does not itself keep the process alive; fires only if something else does.
    setTimeout(() => {
      console.log(`still running ${FORCE_EXIT_AFTER_MS / 1000}s after idle shutdown, forcing exit`);
      process.exit(0);
    }, FORCE_EXIT_AFTER_MS).unref();
    process.kill(process.pid, 'SIGTERM');
  }
}
