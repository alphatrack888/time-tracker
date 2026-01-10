import { Model, Types } from 'mongoose';

export type IProject = {
  _id: Types.ObjectId;
  title:string
  company: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  duration: number;
  projectTime: number;
  images: string[];
  audio: string;
  description: string;
  status: string;
  employees: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectModel = Model<IProject>;


export type IPackageFilterables = {
  searchTerm?:string
  status?:string
  description?:string
  title?:string
}