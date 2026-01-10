// import { Worker, Job } from 'bullmq';
// import { sendNotification } from './notificationHelper';
// import { logger } from '../shared/logger';
// import { emailHelper } from './emailHelper';
// import RedisManager from '../config/redis';

// // Worker instances (will be initialized lazily)
// let notificationWorker: Worker | null = null;
// let emailWorker: Worker | null = null;

// // Initialize workers lazily
// const initializeWorkers = () => {
//   if (!notificationWorker || !emailWorker) {
//     const redisConnection = RedisManager.getInstance().createNewConnection({}, true);
    
//     notificationWorker = new Worker(
//       'notifications',
//       async (job: Job) => {
//         const startTime = Date.now()
//         logger.info(`🎭 Notification worker starting job ${job.id}...`);

//         try {
//           const notifications = job.data;

//           for (const [index, notification] of notifications.entries()) {
//             try {
//               // Validate required fields
//               if (!notification.from || !notification.to || !notification.title || !notification.body) {
//                 logger.warn(`Skipping notification ${index + 1} with missing required fields:`, {
//                   from: !!notification.from,
//                   to: !!notification.to,
//                   title: !!notification.title,
//                   body: !!notification.body
//                 });
//                 continue;
//               }

//              const result = await sendNotification(
//                 notification.from,
//                 notification.to,
//                 notification.title,
//                 notification.body,
//                 notification.deviceToken
//               );
//               console.log(result)

//               logger.info(`✅ Notification ${index + 1}/${notifications.length} sent from ${notification.from} to ${notification.to}`);
//             } catch (notificationError) {
//               logger.error(`❌ Failed to send notification ${index + 1}:`, notificationError);
//             }
//           }

//           const duration = Date.now() - startTime;
//           logger.info(`✅ Notification worker completed job ${job.id} in ${duration}ms`);

//         } catch (err) {
//           const duration = Date.now() - startTime;
//           logger.error(`❌ Notification worker failed for job ${job.id} after ${duration}ms:`, err);
//           throw err; // rethrow to trigger retry
//         }
//       },
//       {
//         connection: redisConnection,
//         concurrency: 5,
//       }
//     );

//     emailWorker = new Worker(
//       'emails',
//       async (job: Job) => {
//         const startTime = Date.now()
//         logger.info(`📧 Email worker starting job ${job.id}...`);

//         try {
//           await emailHelper.sendEmail(job.data);

//           const duration = Date.now() - startTime;
//           logger.info(`✅ Email sent successfully for job ${job.id} in ${duration}ms to ${job.data.to}`);

//         } catch (err) {
//           const duration = Date.now() - startTime;
//           logger.error(`❌ Email worker failed for job ${job.id} after ${duration}ms:`, err);
//           throw err; // rethrow to trigger retry
//         }
//       },
//       {
//         connection: redisConnection,
//         concurrency: 3,
//       }
//     );
    
//     logger.info('BullMQ workers initialized');
//   }
//   return { notificationWorker, emailWorker };
// };



// // Setup event handlers for workers
// const setupWorkerEventHandlers = () => {
//   const { notificationWorker, emailWorker } = initializeWorkers();
  
//   // Enhanced worker event handlers with proper logging
//   notificationWorker!.on('ready', () => {
//     logger.info('🔔 Notification worker is ready');
//   });

//   notificationWorker!.on('active', (job) => {
//     logger.debug(`🔄 Notification job ${job.id} is now active`);
//   });

//   notificationWorker!.on('completed', (job, result) => {
//     logger.debug(`✅ Notification job ${job.id} completed:`, result);
//   });

//   notificationWorker!.on('failed', (job, err) => {
//     logger.error(`❌ Notification job ${job?.id} failed:`, err instanceof Error ? err.message : String(err));
//   });

//   notificationWorker!.on('stalled', (jobId) => {
//     logger.warn(`⏰ Notification job ${jobId} stalled`);
//   });

//   notificationWorker!.on('error', (err) => {
//     logger.error('❌ Notification worker error:', err);
//   });

//   // Email worker event handlers
//   emailWorker!.on('ready', () => {
//     logger.info('📧 Email worker is ready');
//   });

//   emailWorker!.on('active', (job) => {
//     logger.debug(`🔄 Email job ${job.id} is now active`);
//   });

//   emailWorker!.on('completed', (job, result) => {
//     logger.debug(`✅ Email job ${job.id} completed:`, result);
//   });

//   emailWorker!.on('failed', (job, err) => {
//     logger.error(`❌ Email job ${job?.id} failed:`, err instanceof Error ? err.message : String(err));
//   });

//   emailWorker!.on('stalled', (jobId) => {
//     logger.warn(`⏰ Email job ${jobId} stalled`);
//   });

//   emailWorker!.on('error', (err) => {
//     logger.error('❌ Email worker error:', err);
//   });
// };

// // Worker management functions
// export const startWorkers = async (): Promise<void> => {
//   logger.info('🚀 Starting BullMQ workers...');
//   initializeWorkers();
//   setupWorkerEventHandlers();
//   // Workers start automatically when instantiated
// };

// export const stopWorkers = async (): Promise<void> => {
//   logger.info('🛑 Stopping BullMQ workers...');
//   if (notificationWorker && emailWorker) {
//     await Promise.all([
//       notificationWorker.close(),
//       emailWorker.close()
//     ]);
//     logger.info('✅ All workers stopped successfully');
//   }
// };

// // Export getter functions for workers
// export const getNotificationWorker = () => {
//   const { notificationWorker } = initializeWorkers();
//   setupWorkerEventHandlers();
//   return notificationWorker!;
// };

// export const getEmailWorker = () => {
//   const { emailWorker } = initializeWorkers();
//   setupWorkerEventHandlers();
//   return emailWorker!;
// };

// // Legacy exports for backward compatibility
// export { getNotificationWorker as notificationWorker, getEmailWorker as emailWorker };



