import { Model, Types } from 'mongoose';

// Deliberately excludes 'account' — that category is mandatory (see
// notificationTemplates.ts MANDATORY_CATEGORIES) and so has no toggle at
// all, structurally, rather than a toggle the server just refuses to obey.
export type ToggleableCategories = {
  leave: boolean;
  project: boolean;
  payroll: boolean;
  overtime: boolean;
  attendance: boolean;
  subscription: boolean;
};

// 'realtime' (default): each notification pushes individually, as it
// happens. 'daily': individual notifications still create their in-app row
// (so the notification list/badge stays accurate), but push is withheld
// and batched into a single once-daily summary push instead — see
// runNotificationDigestSweep. A global per-user setting for v1, not
// per-category — the plan explicitly allows this simpler shape ("a simpler
// global toggle if that's sufficient for v1"), and a per-category digest
// schedule wasn't an actual product ask.
export type DigestMode = 'realtime' | 'daily';

export type INotificationPreference = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  pushEnabled: boolean;
  categories: ToggleableCategories;
  digestMode: DigestMode;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationPreferenceModel = Model<INotificationPreference>;

export const DEFAULT_CATEGORIES: ToggleableCategories = {
  leave: true,
  project: true,
  payroll: true,
  overtime: true,
  attendance: true,
  subscription: true,
};
