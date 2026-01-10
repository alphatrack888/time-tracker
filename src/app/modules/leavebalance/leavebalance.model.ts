import { Schema, model } from 'mongoose';
import { ILeavebalance, LeavebalanceModel } from './leavebalance.interface'; 

const leavebalanceSchema = new Schema<ILeavebalance, LeavebalanceModel>({
  company: { type: Schema.Types.ObjectId, ref: 'User', populate: {
    path: 'company',
    select: 'name email',
  } },
  casualLeave: { type: Number, default: 10 },
  sickLeave: { type: Number, default: 10 },
  earnLeave: { type: Number, default: 2 },
  wpLeave: { type: Number, default: 365 },
}, {
  timestamps: true
});

export const Leavebalance = model<ILeavebalance, LeavebalanceModel>('Leavebalance', leavebalanceSchema);
