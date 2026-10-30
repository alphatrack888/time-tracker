import { Model, Types } from 'mongoose'

export type INotification = {
  _id: Types.ObjectId
  to: Types.ObjectId
  from: Types.ObjectId
  title: string
  body: string
  /**
   * Title and body for each app language, written when the notification is
   * created. The list request picks one. Absent on rows saved before this
   * field existed, and a literal send only fills `english`.
   */
  translations?: Partial<Record<'english' | 'german' | 'arabic' | 'romanian', { title?: string; body?: string }>>
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
   * Set only for project-added and overtime alerts, where the employee can
   * still load the project. Absent for removal (the employee is no longer
   * assigned) and for every other kind. Old rows omit it.
   */
  projectId?: string

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
