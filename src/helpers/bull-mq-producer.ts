// import { Queue } from "bullmq";
// import RedisManager from "../config/redis";
// import { logger } from "../shared/logger";

// // Queue instances (will be initialized lazily)
// let notificationQueue: Queue | null = null;
// let emailQueue: Queue | null = null;

// // Default job options
// const defaultJobOptions = {
//   removeOnComplete: 100, // Keep last 100 completed jobs
//   removeOnFail: 50,      // Keep last 50 failed jobs
//   attempts: 3,           // Retry failed jobs 3 times
//   backoff: {
//     type: 'exponential',
//     delay: 2000,
//   },
// };

// // Initialize queues lazily
// const initializeQueues = () => {
//   if (!notificationQueue || !emailQueue) {
//     const redisConnection = RedisManager.getInstance().createNewConnection({}, true);
    
//     const queueConfig = {
//       connection: redisConnection,
//       defaultJobOptions,
//     };
    
//     notificationQueue = new Queue('notifications', queueConfig);
//     emailQueue = new Queue('emails', queueConfig);
    
//     logger.info('BullMQ queues initialized');
//   }
//   return { notificationQueue, emailQueue };
// };

// // Queue event handlers for monitoring (only error events are available on Queue)
// const setupQueueEventHandlers = () => {
//   const { notificationQueue, emailQueue } = initializeQueues();
  
//   notificationQueue!.on('error', (error) => {
//     logger.error('❌ Notification queue error:', error);
//   });

//   emailQueue!.on('error', (error) => {
//     logger.error('❌ Email queue error:', error);
//   });
// };

// // Helper functions for adding jobs
// export const addNotificationJob = async (notifications: any[], options?: any) => {
//   try {
//     const { notificationQueue } = initializeQueues();
//     setupQueueEventHandlers();
//     const job = await notificationQueue!.add('send-notifications', notifications, options);
//     logger.info(`📬 Notification job ${job.id} added to queue`);
//     return job;
//   } catch (error) {
//     logger.error('❌ Failed to add notification job:', error);
//     throw error;
//   }
// };

// export const addEmailJob = async (emailData: any, options?: any) => {
//   try {
//     const { emailQueue } = initializeQueues();
//     setupQueueEventHandlers();
//     const job = await emailQueue!.add('send-email', emailData, options);
//     logger.info(`📧 Email job ${job.id} added to queue`);
//     return job;
//   } catch (error) {
//     logger.error('❌ Failed to add email job:', error);
//     throw error;
//   }
// };

// // Queue management functions
// export const getQueueStats = async () => {
//   try {
//     const { notificationQueue, emailQueue } = initializeQueues();
//     const [notificationStats, emailStats] = await Promise.all([
//       {
//         name: 'notifications',
//         waiting: await notificationQueue!.getWaiting(),
//         active: await notificationQueue!.getActive(),
//         completed: await notificationQueue!.getCompleted(),
//         failed: await notificationQueue!.getFailed(),
//       },
//       {
//         name: 'emails',
//         waiting: await emailQueue!.getWaiting(),
//         active: await emailQueue!.getActive(),
//         completed: await emailQueue!.getCompleted(),
//         failed: await emailQueue!.getFailed(),
//       }
//     ]);
    
//     return { notificationStats, emailStats };
//   } catch (error) {
//     logger.error('❌ Failed to get queue stats:', error);
//     throw error;
//   }
// };

// export const closeQueues = async () => {
//   try {
//     const { notificationQueue, emailQueue } = initializeQueues();
//     await Promise.all([
//       notificationQueue!.close(),
//       emailQueue!.close()
//     ]);
//     logger.info('✅ All queues closed successfully');
//   } catch (error) {
//     logger.error('❌ Failed to close queues:', error);
//     throw error;
//   }
// };

// // Export getter functions for queues
// export const getNotificationQueue = () => {
//   const { notificationQueue } = initializeQueues();
//   setupQueueEventHandlers();
//   return notificationQueue!;
// };

// export const getEmailQueue = () => {
//   const { emailQueue } = initializeQueues();
//   setupQueueEventHandlers();
//   return emailQueue!;
// };







