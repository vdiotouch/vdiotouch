import { Queue } from 'bullmq';

/** A group of identical worker replicas that consume the same queue(s). */
export interface ProcessorPool {
  name: string;
  queues: Queue[];
  max_processors: number;
}

/** What an autoscaler needs to size one pool. */
export interface PoolBacklog {
  pool: string;
  queues: string[];
  waiting: number;
  active: number;
  max: number;
  // min(waiting + active, max): the replica count the pool should have right now.
  wanted: number;
}
