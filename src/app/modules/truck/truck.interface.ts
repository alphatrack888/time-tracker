import { Model, Types } from 'mongoose';

export type TruckStatus = 'active' | 'maintenance' | 'inactive';

export type ITruck = {
  _id: Types.ObjectId;
  company: Types.ObjectId;
  identifier: string;
  status: TruckStatus;
  assignedDriver?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type ITruckFilterables = {
  status?: TruckStatus;
};

export type TruckModel = Model<ITruck>;
