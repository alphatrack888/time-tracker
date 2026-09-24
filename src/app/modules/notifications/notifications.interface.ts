import { Model, Types } from 'mongoose'

export type INotification = {
  _id: Types.ObjectId
  to: Types.ObjectId
  from: Types.ObjectId
  title: string
  body: string
  isRead: boolean
  /**
   * The notification's preference category (see notificationTemplates.ts's
   * KIND_CATEGORY), persisted alongside the row — not just sent transiently
   * in the FCM push payload (Phase 11) — so a client fetching the in-app
   * list (not just handling a live push) has something to route a tap on.
   * Absent for literal title/body sends with no category (see
   * notificationHelper.ts's LiteralPayload).
   */
  category?: string

  /**
   * Caller-supplied key identifying the triggering business event (e.g.
   * `leaveRequest:<id>:submitted`). Unique+sparse indexed: a second create
   * with the same key is a no-op (caught as a duplicate-key error), making
   * notification creation safe to retry. Absent for ad-hoc/manual sends
   * that have no natural dedupe key.
   */
  idempotencyKey?: string
  createdAt: Date
  updatedAt: Date
}

export type NotificationModel = Model<INotification>
