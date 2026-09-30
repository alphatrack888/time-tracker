import { Schema, model } from 'mongoose';
import { IPayrole, PayroleModel } from './payrole.interface'; 

const payroleSchema = new Schema<IPayrole, PayroleModel>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', populate:{path:'company',select:'name'} },
  employee: { type: Schema.Types.ObjectId, ref: 'User', populate:{path:'employee',select:'name email'} },
  payroleDate: { type: Date },  
  project: { type: Schema.Types.ObjectId, ref: 'Project', populate:{path:'project',select:'name'} },
  // Company-uploaded payslip/document URLs (see payrole.route.ts's
  // fileAndBodyProcessorUsingDiskStorage + payrole.controller.ts) — these
  // are documents the company prepared and uploaded themselves, never
  // generated server-side. Confirmed as the intentional design during the
  // integration plan's Phase 5 (reports engine expansion): unlike the
  // timetracker monthly/attendance reports, there is no PDF/Excel generator
  // for payroll anywhere in this codebase, and none is planned — if a
  // future engineer is looking for one, it doesn't exist by design, not by
  // omission.
  files: { type: [String] },
}, {
  timestamps: true
});

export const Payrole = model<IPayrole, PayroleModel>('Payrole', payroleSchema);
