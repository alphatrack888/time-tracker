// // Queue Manager - Modern implementation using QueueService
// import QueueService, { JobType, JobData, JobResult } from './queServices';
// import { sendNotification } from './notificationHelper';
// import { emailHelper } from './emailHelper';
// import { logger } from '../shared/logger';
// import { Job } from 'bullmq';

// class QueueManager {
//   private static instance: QueueManager;
//   private queueService: QueueService | null = null;
//   private isInitialized = false;

//   private constructor() {
//     // QueueService will be initialized lazily
//   }

//   public static getInstance(): QueueManager {
//     if (!QueueManager.instance) {
//       QueueManager.instance = new QueueManager();
//     }
//     return QueueManager.instance;
//   }

//   /**
//    * Initialize queues and workers
//    */
//   public async initialize(): Promise<void> {
//     if (this.isInitialized) {
//       return;
//     }

//     try {
//       // Initialize QueueService
//       this.queueService = new QueueService();
      
//       // Create notification queue and worker
//       this.queueService.createQueue('notifications');
//       this.queueService.createWorker('notifications', this.processNotificationJob.bind(this), {
//         concurrency: 5,
//         connection: {
//           host: process.env.REDIS_HOST || 'localhost',
//           port: parseInt(process.env.REDIS_PORT || '6379'),
//         },
//       });

//       // Create email queue and worker
//       this.queueService.createQueue('emails');
//       this.queueService.createWorker('emails', this.processEmailJob.bind(this), {
//         concurrency: 3,
//         connection: {
//           host: process.env.REDIS_HOST || 'localhost',
//           port: parseInt(process.env.REDIS_PORT || '6379'),
//         },
//       });

//       this.isInitialized = true;
//       logger.info('✅ QueueManager initialized successfully');
//     } catch (error) {
//       logger.error('❌ Failed to initialize QueueManager:', error);
//       throw error;
//     }
//   }

//   /**
//    * Process notification job
//    */
//   private async processNotificationJob(job: Job): Promise<JobResult> {
//     const startTime = Date.now();
//     logger.info(`🎭 Processing notification job ${job.id}...`);

//     try {
//       const notifications = job.data;
//       const results = [];

//       for (const [index, notification] of notifications.entries()) {
//         try {
//           // Validate required fields
//           if (!notification.from || !notification.to || !notification.title || !notification.body) {
//             logger.warn(`Skipping notification ${index + 1} with missing required fields:`, {
//               from: !!notification.from,
//               to: !!notification.to,
//               title: !!notification.title,
//               body: !!notification.body
//             });
//             continue;
//           }

//           const result = await sendNotification(
//             notification.from,
//             notification.to,
//             notification.title,
//             notification.body,
//             notification.deviceToken
//           );

//           results.push(result);
//           logger.info(`✅ Notification ${index + 1}/${notifications.length} sent from ${notification.from} to ${notification.to}`);
//         } catch (notificationError) {
//           logger.error(`❌ Failed to send notification ${index + 1}:`, notificationError);
//           results.push({ success: false, error: notificationError });
//         }
//       }

//       const duration = Date.now() - startTime;
//       logger.info(`✅ Notification job ${job.id} completed in ${duration}ms`);

//       return {
//         success: true,
//         data: {
//           processed: notifications.length,
//           successful: results.filter(r => r && typeof r === 'object' && 'success' in r && r.success !== false).length,
//           failed: results.filter(r => r && typeof r === 'object' && 'success' in r && r.success === false).length,
//           results
//         }
//       };
//     } catch (error) {
//       const duration = Date.now() - startTime;
//       logger.error(`❌ Notification job ${job.id} failed after ${duration}ms:`, error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : String(error)
//       };
//     }
//   }

//   /**
//    * Process email job
//    */
//   private async processEmailJob(job: Job): Promise<JobResult> {
//     const startTime = Date.now();
//     logger.info(`📧 Processing email job ${job.id}...`);

//     try {
//       await emailHelper.sendEmail(job.data);

//       const duration = Date.now() - startTime;
//       logger.info(`✅ Email sent successfully for job ${job.id} in ${duration}ms to ${job.data.to}`);

//       return {
//         success: true,
//         data: {
//           to: job.data.to,
//           subject: job.data.subject,
//           sentAt: new Date().toISOString()
//         }
//       };
//     } catch (error) {
//       const duration = Date.now() - startTime;
//       logger.error(`❌ Email job ${job.id} failed after ${duration}ms:`, error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : String(error)
//       };
//     }
//   }

//   /**
//    * Add notification job to queue
//    */
//   public async addNotificationJob(notifications: any[], options?: any): Promise<Job> {
//     await this.ensureInitialized();
    
//     try {
//       if (!this.queueService) {
//         throw new Error('QueueManager not initialized');
//       }
      
//       const job = await this.queueService.addJob(
//         'notifications',
//         JobType.SEND_NOTIFICATION,
//         notifications,
//         options
//       );
      
//       logger.info(`📬 Notification job ${job.id} added to queue`);
//       return job;
//     } catch (error) {
//       logger.error('❌ Failed to add notification job:', error);
//       throw error;
//     }
//   }

//   /**
//    * Add email job to queue
//    */
//   public async addEmailJob(emailData: any, options?: any): Promise<Job> {
//     await this.ensureInitialized();
    
//     try {
//       if (!this.queueService) {
//         throw new Error('QueueManager not initialized');
//       }
      
//       const job = await this.queueService.addJob(
//         'emails',
//         JobType.SEND_EMAIL,
//         emailData,
//         options
//       );
      
//       logger.info(`📧 Email job ${job.id} added to queue`);
//       return job;
//     } catch (error) {
//       logger.error('❌ Failed to add email job:', error);
//       throw error;
//     }
//   }

//   /**
//    * Add delayed notification job
//    */
//   public async addDelayedNotificationJob(notifications: any[], delayInMs: number): Promise<Job> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.addDelayedJob('notifications', JobType.SEND_NOTIFICATION, notifications, delayInMs);
//   }

//   /**
//    * Add delayed email job
//    */
//   public async addDelayedEmailJob(emailData: any, delayInMs: number): Promise<Job> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.addDelayedJob('emails', JobType.SEND_EMAIL, emailData, delayInMs);
//   }

//   /**
//    * Add recurring notification job
//    */
//   public async addRecurringNotificationJob(notifications: any[], cronPattern: string, jobId?: string): Promise<Job> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.addRecurringJob('notifications', JobType.SEND_NOTIFICATION, notifications, cronPattern, jobId);
//   }

//   /**
//    * Add recurring email job
//    */
//   public async addRecurringEmailJob(emailData: any, cronPattern: string, jobId?: string): Promise<Job> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.addRecurringJob('emails', JobType.SEND_EMAIL, emailData, cronPattern, jobId);
//   }

//   /**
//    * Get comprehensive queue statistics
//    */
//   public async getQueueStats() {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.getAllQueueStats();
//   }

//   /**
//    * Get specific queue statistics
//    */
//   public async getNotificationQueueStats() {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.getQueueStats('notifications');
//   }

//   public async getEmailQueueStats() {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.getQueueStats('emails');
//   }

//   /**
//    * Clean old jobs from queues
//    */
//   public async cleanQueues(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
    
//     const [notificationResult, emailResult] = await Promise.all([
//       this.queueService.cleanQueue('notifications', maxAge),
//       this.queueService.cleanQueue('emails', maxAge)
//     ]);
    
//     logger.info('🧹 Queue cleanup completed:', {
//       notifications: notificationResult,
//       emails: emailResult
//     });
//   }

//   /**
//    * Retry failed jobs
//    */
//   public async retryFailedJobs(maxRetries: number = 10): Promise<void> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
    
//     const [notificationRetries, emailRetries] = await Promise.all([
//       this.queueService.retryFailedJobs('notifications', maxRetries),
//       this.queueService.retryFailedJobs('emails', maxRetries)
//     ]);
    
//     logger.info('🔄 Failed jobs retry completed:', {
//       notifications: notificationRetries,
//       emails: emailRetries
//     });
//   }

//   /**
//    * Pause/Resume queues
//    */
//   public async pauseQueues(): Promise<void> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     await Promise.all([
//       this.queueService.pauseQueue('notifications'),
//       this.queueService.pauseQueue('emails')
//     ]);
//   }

//   public async resumeQueues(): Promise<void> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     await Promise.all([
//       this.queueService.resumeQueue('notifications'),
//       this.queueService.resumeQueue('emails')
//     ]);
//   }

//   /**
//    * Pause/Resume workers
//    */
//   public async pauseWorkers(): Promise<void> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     await Promise.all([
//       this.queueService.pauseWorker('notifications'),
//       this.queueService.pauseWorker('emails')
//     ]);
//   }

//   public async resumeWorkers(): Promise<void> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     await Promise.all([
//       this.queueService.resumeWorker('notifications'),
//       this.queueService.resumeWorker('emails')
//     ]);
//   }

//   /**
//    * Get job by ID
//    */
//   public async getNotificationJob(jobId: string) {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.getJob('notifications', jobId);
//   }

//   public async getEmailJob(jobId: string) {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.getJob('emails', jobId);
//   }

//   /**
//    * Remove job by ID
//    */
//   public async removeNotificationJob(jobId: string): Promise<boolean> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.removeJob('notifications', jobId);
//   }

//   public async removeEmailJob(jobId: string): Promise<boolean> {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.removeJob('emails', jobId);
//   }

//   /**
//    * Get jobs by state
//    */
//   public async getNotificationJobs(state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed', start = 0, end = -1) {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.getJobs('notifications', state, start, end);
//   }

//   public async getEmailJobs(state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed', start = 0, end = -1) {
//     await this.ensureInitialized();
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized');
//     }
//     return this.queueService.getJobs('emails', state, start, end);
//   }

//   /**
//    * Graceful shutdown
//    */
//   public async shutdown(): Promise<void> {
//     if (this.isInitialized && this.queueService) {
//       logger.info('🛑 Shutting down QueueManager...');
//       await this.queueService.close();
//       this.queueService = null;
//       this.isInitialized = false;
//       logger.info('✅ QueueManager shutdown completed');
//     }
//   }

//   /**
//    * Ensure the queue manager is initialized
//    */
//   private async ensureInitialized(): Promise<void> {
//     if (!this.isInitialized || !this.queueService) {
//       await this.initialize();
//     }
//   }

//   /**
//    * Get underlying QueueService instance (for advanced usage)
//    */
//   public getQueueService(): QueueService {
//     if (!this.queueService) {
//       throw new Error('QueueManager not initialized. Call initialize() first.');
//     }
//     return this.queueService;
//   }
// }

// export default QueueManager;

// // Export convenience functions for backward compatibility
// export const queueManager = QueueManager.getInstance();

// export const addNotificationJob = (notifications: any[], options?: any) => 
//   queueManager.addNotificationJob(notifications, options);

// export const addEmailJob = (emailData: any, options?: any) => 
//   queueManager.addEmailJob(emailData, options);

// export const getQueueStats = () => queueManager.getQueueStats();

// export const initializeQueues = () => queueManager.initialize();

// export const closeQueues = () => queueManager.shutdown();