import { Model, Types } from 'mongoose';


export type IGallery = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  image:string;
  createdAt: Date;
  updatedAt: Date;
};

export type GalleryModel = Model<IGallery>;
