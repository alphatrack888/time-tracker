import { Model, Types } from 'mongoose';

export type IPackage = {
  _id: Types.ObjectId;
  title: string;
  price: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PackageModel = Model<IPackage>;
