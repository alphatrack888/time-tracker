import { Notification } from '../app/modules/notifications/notifications.model'
import { logger } from '../shared/logger'
import { socket } from '../utils/socket'
import { sendPushNotification } from './pushnotificationHelper'
import { emitEvent } from './socketInstances'

export const sendNotification = async (
  from: string,
  to: string,
  title: string,
  body: string,
  deviceToken?: string,
) => {
  try {
    const result = await Notification.create({
      from,
      to,
      title,
      body,
      isRead: false,
    })

    if (!result) logger.warn('Notification not sent')

    const populatedResult = await Notification.findById(result._id).populate('from', { profile: 1, name: 1 }).populate('to', { profile: 1, name: 1 }).lean()


    emitEvent(`notification::${to.toString()}`, populatedResult)

    

    if(deviceToken){
     await sendPushNotification(deviceToken, title, body, { from, to })
    }
  } catch (err) {
    //@ts-ignore
    logger.error(err, 'FROM NOTIFICATION HELPER')
  }
}
