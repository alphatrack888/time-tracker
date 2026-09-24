import { Schema, model } from 'mongoose';
import { INotificationPreference, NotificationPreferenceModel } from './notificationpreferences.interface';

const notificationPreferenceSchema = new Schema<INotificationPreference, NotificationPreferenceModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    pushEnabled: { type: Boolean, default: true },
    categories: {
      leave: { type: Boolean, default: true },
      project: { type: Boolean, default: true },
      payroll: { type: Boolean, default: true },
      overtime: { type: Boolean, default: true },
      attendance: { type: Boolean, default: true },
      subscription: { type: Boolean, default: true },
    },
    digestMode: { type: String, enum: ['realtime', 'daily'], default: 'realtime' },
  },
  {
    timestamps: true,
  },
);

export const NotificationPreference = model<INotificationPreference, NotificationPreferenceModel>(
  'NotificationPreference',
  notificationPreferenceSchema,
);
