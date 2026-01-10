import { Schema, model } from 'mongoose';
import {  ILeavemanagement, LeavemanagementModel } from './leavemanagement.interface'; 


const leavemanagementSchema = new Schema<ILeavemanagement, LeavemanagementModel>({

  user: { type: Schema.Types.ObjectId, ref: 'User', populate: {
    path: 'user',
    select: 'name email',
  } },
  company: { type: Schema.Types.ObjectId, ref: 'User', populate: {
    path: 'company',
    select: 'name email',
  } },
  totalDays: { type: Number,default:0 },
  type: { type: String, enum: ['earn', 'sick', 'casual', 'wp'], default: 'earn' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  from: { type: Date },
  to: { type: Date },
  reason: { type: String },
}, {
  timestamps: true
});



export const Leavemanagement = model<ILeavemanagement, LeavemanagementModel>('Leavemanagement', leavemanagementSchema);
