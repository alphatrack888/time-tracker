import { Schema, model } from 'mongoose';
import { IDeviceToken, DeviceTokenModel } from './devicetoken.interface';

const deviceTokenSchema = new Schema<IDeviceToken, DeviceTokenModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // A push token can only ever be registered to one user at a time — the
    // unique index is what makes `registerDeviceToken`'s upsert behave as a
    // reassignment (kiosk/shared-device handoff) rather than a duplicate row.
    token: { type: String, required: true, unique: true },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web', 'unknown'],
      default: 'unknown',
    },
    appVersion: { type: String },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

deviceTokenSchema.index({ user: 1 });

export const DeviceToken = model<IDeviceToken, DeviceTokenModel>('DeviceToken', deviceTokenSchema);
