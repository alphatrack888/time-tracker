// import { StatusCodes } from "http-status-codes";
// import ApiError from "../errors/ApiError";
// import { addNotificationJob, addEmailJob } from "./queueManager";
// import { logger } from "../shared/logger";

// export const addItemsToQueue = async (type:string | 'notifications' |'emails', data:any) => {
//   try{
//     switch(type) {
//       case 'notifications':
//         // Ensure data is always an array for notifications
//         const notificationData = Array.isArray(data) ? data : [data]
//         await addNotificationJob(notificationData)
//         logger.info(`Added ${notificationData.length} notification(s) to queue`)
//         break;
//       case 'emails':
//         await addEmailJob(data)
//         logger.info('Added email to queue')
//         break;
//       default:
//         logger.warn(`Unknown queue type: ${type}`)
//         break;
//     }
//   } catch (error) {
//     logger.error('Failed to add item to queue:', error)
//     throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to add item to queue, please try again.')
//   }
// }