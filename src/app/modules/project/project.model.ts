import { Schema,  model } from 'mongoose';
import { IProject, ProjectModel } from './project.interface';

const projectSchema = new Schema<IProject, ProjectModel>({
  title: { type: String },
  employees: { type: [Schema.Types.ObjectId], ref: 'User' , populate: {
    path: 'employees',
    select: 'name email',
  }},
  company: { type: Schema.Types.ObjectId, ref: 'User', populate: {
    path: 'company',
    select: 'name',
  }},
  duration: { type: Number, default: 0 },
  startDate: { type: Date },
  endDate: { type: Date },
  projectTime: { type: Number },
  images: { type: [String] },
  audio: { type: String },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  description: { type: String },

}, {
  timestamps: true
});

projectSchema.index({ employees: 1, startDate: 1, endDate: 1 });

export const Project = model<IProject, ProjectModel>('Project', projectSchema);
