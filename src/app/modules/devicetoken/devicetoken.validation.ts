import { z } from 'zod';

export const DeviceTokenValidations = {
  register: z.object({
    body: z.object({
      token: z
        .string({ required_error: 'token is required' })
        .min(10, 'token looks too short to be a valid push token'),
      platform: z.enum(['ios', 'android', 'web']).optional(),
      appVersion: z.string().optional(),
    }),
  }),
};
