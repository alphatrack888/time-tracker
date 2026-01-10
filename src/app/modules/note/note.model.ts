import { Schema, model } from 'mongoose';
import { INote, NoteModel } from './note.interface'; 

const noteSchema = new Schema<INote, NoteModel>({

  project: { type: Schema.Types.ObjectId, ref: 'Project', populate:{
    path: 'project',
    select: 'name profile'
  } },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', populate:{
    path: 'createdBy',
    select: 'name profile'
  } },
  audio: { type: [String] },
  content: { type: String },
  images: { type: [String] },
  files: { type: [String] },
}, {
  timestamps: true
});

export const Note = model<INote, NoteModel>('Note', noteSchema);
