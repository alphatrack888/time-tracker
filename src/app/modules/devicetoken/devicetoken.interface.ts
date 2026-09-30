import { Model, Types } from 'mongoose';

export type DeviceTokenPlatform = 'ios' | 'android' | 'web' | 'unknown';

export type IDeviceToken = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  token: string;
  platform: DeviceTokenPlatform;
  appVersion?: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type DeviceTokenModel = Model<IDeviceToken>;
