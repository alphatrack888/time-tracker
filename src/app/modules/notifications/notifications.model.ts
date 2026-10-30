import { Schema, model } from 'mongoose'
import { INotification, NotificationModel } from './notifications.interface'

const translationPairSchema = new Schema(
  { title: { type: String }, body: { type: String } },
  { _id: false },
)

const notificationSchema = new Schema<INotification, NotificationModel>(
  {
    to: { type: Schema.Types.ObjectId, ref: 'User' , populate: 'name profile' },
    from: { type: Schema.Types.ObjectId, ref: 'User', populate: 'name profile' },
    title: { type: String },
    body: { type: String },
    translations: {
      type: new Schema(
        {
          english: translationPairSchema,
          german: translationPairSchema,
          arabic: translationPairSchema,
          romanian: translationPairSchema,
        },
        { _id: false },
      ),
    },
    isRead: { type: Boolean },
    category: { type: String },
    projectId: { type: String },
    idempotencyKey: { type: String, unique: true, sparse: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  {
    timestamps: true,
  },
)

export const Notification = model<INotification, NotificationModel>(
  'Notification',
  notificationSchema,
)
