import { Schema, model } from 'mongoose';
import { IGallery, GalleryModel } from './gallery.interface'; 

const gallerySchema = new Schema<IGallery, GalleryModel>({
  _id: { type: Schema.Types.ObjectId },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  image: { type: String },
}, {
  timestamps: true
});

export const Gallery = model<IGallery, GalleryModel>('Gallery', gallerySchema);
