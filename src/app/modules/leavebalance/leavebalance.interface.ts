import { Model, Types } from 'mongoose';

export type ILeavebalance = {
  _id: Types.ObjectId;
  company: Types.ObjectId;
  casualLeave: number;
  sickLeave: number;
  earnLeave: number;
  wpLeave: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LeavebalanceModel = Model<ILeavebalance>;
