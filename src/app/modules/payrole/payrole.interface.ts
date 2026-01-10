import { Model, Types } from 'mongoose';

export type IPayrole = {
  _id: Types.ObjectId;
  company: Types.ObjectId;
  employee: Types.ObjectId;
  payroleDate?: Date;
  project?: Types.ObjectId;
  files: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type IPayroleFilterables = {
  employee?: Types.ObjectId;
  project?: Types.ObjectId;
};

export type PayroleModel = Model<IPayrole>;
