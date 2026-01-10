import { Schema, model } from 'mongoose';
import { IPackage, PackageModel } from './package.interface'; 

const packageSchema = new Schema<IPackage, PackageModel>({
  title: { type: String },
  price: { type: Number },
  features: { type: [String] },
  isActive: { type: Boolean },
}, {
  timestamps: true
});

export const Package = model<IPackage, PackageModel>('Package', packageSchema);
