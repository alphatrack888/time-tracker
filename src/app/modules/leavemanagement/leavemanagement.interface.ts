import { Model, Types } from 'mongoose';



export type ILeavemanagement = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  company: Types.ObjectId;
  type: string;
  status: string;
  from: Date;
  to: Date;
  totalDays: number;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LeavemanagementModel = Model<ILeavemanagement>;


export type ILeavemanagementFilterables = {
  user?: Types.ObjectId;
  type?: string;
  status?: string;
}
