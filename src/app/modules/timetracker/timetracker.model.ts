import { Schema, model } from 'mongoose';
import { ITimeSession, TimeSessionModel } from './timetracker.interface';

const locationSchema = new Schema({
  timestamp: { type: Date, required: true },
  coordinates: { type: [Number], required: true }, // [longitude, latitude]
  action: { type: String, enum: ['start', 'pause', 'resume', 'stop', 'periodic'], required: true },
}, { _id: false });

const timeSessionSchema = new Schema<ITimeSession, TimeSessionModel>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: Schema.Types.ObjectId, ref: 'Project' },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  pauses: [{ start: Date, end: Date }],
  totalTime: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused', 'stopped'], default: 'active' },
  locations: [locationSchema],
  date: { type: String, required: true }, // YYYY-MM-DD
}, {
  timestamps: true,
});

// Indexes for efficient queries
timeSessionSchema.index({ user: 1, date: 1 });
timeSessionSchema.index({ user: 1, status: 1 });
timeSessionSchema.index({ 'locations.coordinates': '2dsphere' });

export const TimeSession = model<ITimeSession, TimeSessionModel>('TimeSession', timeSessionSchema);