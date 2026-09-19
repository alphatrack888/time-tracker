import { Schema, model } from 'mongoose';
import { ITruck, TruckModel } from './truck.interface';

const truckSchema = new Schema<ITruck, TruckModel>({
  company: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  identifier: { type: String, required: true },
  status: { type: String, enum: ['active', 'maintenance', 'inactive'], default: 'active' },
  assignedDriver: { type: Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

export const Truck = model<ITruck, TruckModel>('Truck', truckSchema);
