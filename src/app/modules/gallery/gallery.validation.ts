import { z } from 'zod';

export const GalleryValidations = {
  create: z.object({
    body:z.object({
      images: z.array(z.string()),
    })
  }),

  delete: z.object({
    body:z.object({
      images: z.array(z.string()),
    })
  }),

  update: z.object({
    body:z.object({
      images: z.array(z.string()),
    })
  }),
};
