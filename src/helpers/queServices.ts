// src/services/queueService.ts
import { Queue, Worker, Job, QueueOptions, WorkerOptions, JobsOptions, JobProgress } from 'bullmq';
import Redis from 'ioredis';
import RedisManager from '../config/redis';

export interface JobData {
  [key: string]: any;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Define your job types
export enum JobType {
  SEND_EMAIL = 'send-email',
  SEND_NOTIFICATION = 'send-notification',
  PROCESS_IMAGE = 'process-image',
  GENERATE_REPORT = 'generate-report',
  CLEANUP_FILES = 'cleanup-files',
}

class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisConnection: Redis;

  constructor() {
    // Use the shared Redis manager to create a new connection for Bull MQ
    // Bull MQ needs its own connection to avoid conflicts
    this.redisConnection = RedisManager.getInstance().createNewConnection({}, true);
  }

  /**
   * Create a new queue
   */
  createQueue(name: string, options?: QueueOptions): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,           // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 5000,         // Start with 5s delay, then 10s, 20s, etc.
        },
      },
      ...options,
    });

    // Add queue event listeners
    queue.on('error', (error) => {
      console.error(`Queue ${name} error:`, error);
    });

    queue.on('waiting', (job) => {
      console.log(`Job ${job.id} is waiting in queue ${name}`);
    });

    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Add a job to queue
   */
  async addJob(
    queueName: string,
    jobType: JobType,
    data: JobData,
    options?: JobsOptions
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    
    return await queue.add(jobType, data, {
      priority: 1, // Higher number = higher priority
      delay: 0,    // Delay in milliseconds
      ...options,
    });
  }

  /**
   * Add a delayed job
   */
  async addDelayedJob(
    queueName: string,
    jobType: JobType,
    data: JobData,
    delayInMs: number
  ): Promise<Job> {
    return this.addJob(queueName, jobType, data, { delay: delayInMs });
  }

  /**
   * Add a recurring job (cron-like)
   */
  async addRecurringJob(
    queueName: string,
    jobType: JobType,
    data: JobData,
    cronPattern: string, // e.g., '0 9 * * *' for daily at 9 AM
    jobId?: string
  ): Promise<Job> {
    return this.addJob(queueName, jobType, data, {
      repeat: { pattern: cronPattern },
      jobId: jobId || `${jobType}-recurring`,
    });
  }

  /**
   * Create a worker to process jobs
   */
  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<JobResult>,
    options?: WorkerOptions
  ): Worker {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(
      queueName,
      async (job: Job) => {
        console.log(`🔄 Processing job ${job.id} of type ${job.name} in queue ${queueName}`);
        
        const startTime = Date.now();
        
        try {
          const result = await processor(job);
          const duration = Date.now() - startTime;
          console.log(`✅ Job ${job.id} completed successfully in ${duration}ms`);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`❌ Job ${job.id} failed after ${duration}ms:`, error);
          throw error;
        }
      },
      {
        connection: RedisManager.getInstance().createNewConnection({}, true),
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
        ...options,
      }
    );

    // Add comprehensive event listeners
    worker.on('completed', (job: Job, result: JobResult) => {
      console.log(`✅ Job ${job.id} completed with result:`, result.success ? 'SUCCESS' : 'FAILED');
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    worker.on('progress', (job: Job, progress: JobProgress) => {
      console.log(`📊 Job ${job.id} is ${progress}% complete`);
    });

    worker.on('error', (error: Error) => {
      console.error(`Worker error for queue ${queueName}:`, error);
    });

    worker.on('stalled', (jobId: string) => {
      console.warn(`⚠️  Job ${jobId} stalled in queue ${queueName}`);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  /**
   * Get queue instance
   */
  getQueue(name: string): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue "${name}" not found. Create it first with createQueue()`);
    }
    return queue;
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    return await queue.getJob(jobId);
  }

  /**
   * Get jobs by state
   */
  async getJobs(queueName: string, state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed', start = 0, end = -1): Promise<Job[]> {
    const queue = this.getQueue(queueName);
    
    switch (state) {
      case 'waiting':
        return await queue.getWaiting(start, end);
      case 'active':
        return await queue.getActive(start, end);
      case 'completed':
        return await queue.getCompleted(start, end);
      case 'failed':
        return await queue.getFailed(start, end);
      case 'delayed':
        return await queue.getDelayed(start, end);
      default:
        throw new Error(`Invalid job state: ${state}`);
    }
  }

  /**
   * Get comprehensive queue statistics
   */
  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
      queue.isPaused(),
    ]);

    return {
      name: queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length,
    };
  }

  /**
   * Get all queues statistics
   */
  async getAllQueueStats() {
    const stats = [];
    
    for (const [queueName] of this.queues) {
      const queueStats = await this.getQueueStats(queueName);
      stats.push(queueStats);
    }
    
    return stats;
  }

  /**
   * Clean old jobs (production-safe with batching)
   */
  async cleanQueue(queueName: string, maxAge: number = 24 * 60 * 60 * 1000, batchSize: number = 100): Promise<{ completed: number; failed: number }> {
    const queue = this.getQueue(queueName);
    
    const [completedCleaned, failedCleaned] = await Promise.all([
      queue.clean(maxAge, batchSize, 'completed'),
      queue.clean(maxAge, batchSize, 'failed'),
    ]);

    return {
      completed: completedCleaned.length,
      failed: failedCleaned.length,
    };
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(queueName: string, maxRetries: number = 10): Promise<number> {
    const queue = this.getQueue(queueName);
    const failedJobs = await queue.getFailed(0, maxRetries - 1);
    
    let retriedCount = 0;
    
    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        console.error(`Failed to retry job ${job.id}:`, error);
      }
    }
    
    return retriedCount;
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    console.log(`Queue ${queueName} paused`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    console.log(`Queue ${queueName} resumed`);
  }

  /**
   * Remove job by ID
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.remove();
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to remove job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(queueName: string) {
    const worker = this.workers.get(queueName);
    if (!worker) {
      return null;
    }

    return {
      name: queueName,
      running: worker.isRunning(),
      paused: worker.isPaused(),
      concurrency: worker.opts.concurrency || 1,
    };
  }

  /**
   * Pause worker
   */
  async pauseWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.pause();
      console.log(`Worker for queue ${queueName} paused`);
    }
  }

  /**
   * Resume worker
   */
  async resumeWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      worker.resume();
      console.log(`Worker for queue ${queueName} resumed`);
    }
  }

  /**
   * Close all connections gracefully
   */
  async close(): Promise<void> {
    console.log('🔄 Closing queue service...');
    
    // Close all workers first
    const workerClosePromises = Array.from(this.workers.values()).map(async (worker) => {
      try {
        await worker.close();
      } catch (error) {
        console.error('Error closing worker:', error);
      }
    });
    
    await Promise.all(workerClosePromises);

    // Close all queues
    const queueClosePromises = Array.from(this.queues.values()).map(async (queue) => {
      try {
        await queue.close();
      } catch (error) {
        console.error('Error closing queue:', error);
      }
    });
    
    await Promise.all(queueClosePromises);

    // Close Redis connection
    try {
      await this.redisConnection.disconnect();
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }

    console.log('✅ Queue service closed successfully');
  }
}

export default QueueService;