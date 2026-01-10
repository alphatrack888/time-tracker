import { Model, Types } from 'mongoose';

export type ILocation = {
  timestamp: Date;
  coordinates: [number, number]; // [longitude, latitude]
  action: 'start' | 'pause' | 'resume' | 'stop' | 'periodic';
};

export type ITimeSession = {
  user: Types.ObjectId;
  project?: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  pauses: { start: Date; end?: Date }[];
  totalTime: number;
  status: 'active' | 'paused' | 'stopped';
  locations: ILocation[];
  date: string; // YYYY-MM-DD for easy daily queries
  createdAt: Date;
  updatedAt: Date;
};

export type TimeSessionModel = Model<ITimeSession>;

export type ITimeSessionFilters = {
  user?: Types.ObjectId;
  project?: Types.ObjectId;
  date?: string; // for daily filtering
};