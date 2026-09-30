import { Model, Types } from 'mongoose';

export type ReportJobStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type ReportJobType = 'attendance';
export type ReportJobFormat = 'pdf' | 'excel';

export type IReportJob = {
  _id: Types.ObjectId;
  requestedBy: Types.ObjectId;
  // The requester's role at the time the job was created, so the background
  // processor (which has no live req.user) can reconstruct the same access
  // scope generateAttendanceReportData expects. Recorded rather than
  // re-derived at processing time because a user's role could theoretically
  // change between request and processing.
  requestedByRole: 'company' | 'admin' | 'super_admin';
  type: ReportJobType;
  format: ReportJobFormat;
  params: {
    startDate: string;
    endDate: string;
    project?: string;
    lang?: 'en' | 'de';
    // ADMIN/SUPER_ADMIN only: scope the report to one company. Omitted by
    // COMPANY requesters (always their own company) and, for admins,
    // omitting it means "every company" — a true cross-company report.
    company?: string;
  };
  status: ReportJobStatus;
  fileUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ReportJobModel = Model<IReportJob>;
