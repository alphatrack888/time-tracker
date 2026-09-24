import { z } from 'zod';

export const NotificationPreferenceValidations = {
  update: z.object({
    body: z.object({
      pushEnabled: z.boolean().optional(),
      // Deliberately not a z.record(z.boolean()): an explicit key list plus
      // .strict() means an unknown key (e.g. a client trying to send
      // `account: false`) is rejected with a validation error rather than
      // silently accepted or silently dropped — 'account' has no toggle at
      // all (see notificationTemplates.ts MANDATORY_CATEGORIES).
      categories: z
        .object({
          leave: z.boolean().optional(),
          project: z.boolean().optional(),
          payroll: z.boolean().optional(),
          overtime: z.boolean().optional(),
          attendance: z.boolean().optional(),
          subscription: z.boolean().optional(),
        })
        .strict()
        .optional(),
      language: z.enum(['en', 'de']).optional(),
      digestMode: z.enum(['realtime', 'daily']).optional(),
    }),
  }),
};
