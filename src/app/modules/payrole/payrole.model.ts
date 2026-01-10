import { Schema, model } from 'mongoose';
import { IPayrole, PayroleModel } from './payrole.interface'; 

const payroleSchema = new Schema<IPayrole, PayroleModel>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', populate:{path:'company',select:'name'} },
  employee: { type: Schema.Types.ObjectId, ref: 'User', populate:{path:'employee',select:'name email'} },
  payroleDate: { type: Date },  
  project: { type: Schema.Types.ObjectId, ref: 'Project', populate:{path:'project',select:'name'} },
  files: { type: [String] },
}, {
  timestamps: true
});

export const Payrole = model<IPayrole, PayroleModel>('Payrole', payroleSchema);
