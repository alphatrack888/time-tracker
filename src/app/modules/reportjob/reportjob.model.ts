import { Schema, model } from 'mongoose';
import { IReportJob, ReportJobModel } from './reportjob.interface';

const reportJobSchema = new Schema<IReportJob, ReportJobModel>(
  {
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByRole: { type: String, enum: ['company', 'admin', 'super_admin'], required: true },
    type: { type: String, enum: ['attendance'], required: true },
    format: { type: String, enum: ['pdf', 'excel'], required: true },
    params: {
      startDate: { type: String, required: true },
      endDate: { type: String, required: true },
      project: { type: String },
      lang: { type: String, enum: ['en', 'de'] },
      company: { type: String },
    },
    status: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
    fileUrl: { type: String },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
  },
);

reportJobSchema.index({ requestedBy: 1, createdAt: -1 });

export const ReportJob = model<IReportJob, ReportJobModel>('ReportJob', reportJobSchema);
