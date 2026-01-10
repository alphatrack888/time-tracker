import { z } from 'zod';

export const NoteValidations = {
  create: z.object({
    params:z.object({
      projectId: z.string()
    }),
    body:z.object({
      content: z.string().optional(),
      images: z.array(z.string()).optional(),
      documents: z.array(z.string()).optional(),
      audio: z.array(z.string()).optional(),
    })

  }),

  update: z.object({
    params:z.object({
      projectId: z.string()
    }),
    body:z.object({
      content: z.string().optional(),
      images: z.array(z.string()).optional(),
      documents: z.array(z.string()).optional(),
      audio: z.array(z.string()).optional(),
    })
  }),
};
