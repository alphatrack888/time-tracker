import { EventEmitter } from 'events'
import { emailHelper } from './emailHelper'
import { sendNotification } from './notificationHelper'
import { ISendEmail } from '../interfaces/email'

export type NotificationEventPayload = {
  from: string
  to: string
  title: string
  body: string
  deviceToken?: string
}

const EMAIL_SEND_EVENT = 'email:send'
const NOTIFICATION_SEND_EVENT = 'notification:send'

class AppEventEmitter extends EventEmitter {}

export const appEvents = new AppEventEmitter()

// emailHelper.sendEmail and sendNotification already catch and log their own
// errors internally, so listeners here don't need to handle rejections.
appEvents.on(EMAIL_SEND_EVENT, (payload: ISendEmail) => {
  emailHelper.sendEmail(payload)
})

appEvents.on(NOTIFICATION_SEND_EVENT, (payload: NotificationEventPayload) => {
  sendNotification(payload.from, payload.to, payload.title, payload.body, payload.deviceToken)
})

export const dispatchEmail = (payload: ISendEmail): void => {
  appEvents.emit(EMAIL_SEND_EVENT, payload)
}

export const dispatchNotification = (payload: NotificationEventPayload): void => {
  appEvents.emit(NOTIFICATION_SEND_EVENT, payload)
}
