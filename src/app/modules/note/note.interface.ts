import { Model, Types } from 'mongoose';

export type INote = {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  createdBy: Types.ObjectId;
  content?: string;
  images?: string[];
  files?: string[];
  audio?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type NoteModel = Model<INote>;


export type INoteFilters = {
  project?: Types.ObjectId;
  createdBy?: Types.ObjectId;
}