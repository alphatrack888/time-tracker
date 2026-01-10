import { z } from 'zod'
import { USER_ROLES } from '../../../enum/user'
import { profile } from 'console'

const createUserZodSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email(),
    password: z.string({ required_error: 'Password is required' }).min(6),
    name: z.string({ required_error: 'Name is required' }).optional(),
    phone: z.string({ required_error: 'Phone is required' }).optional(),
    address: z.string().optional(),
    role: z.enum(
      [
        USER_ROLES.ADMIN,
        USER_ROLES.EMPLOYEES,
        USER_ROLES.COMPANY,

      ],
      {
        message: 'Role must be one of admin, user, company',
      },
    ),
  }),
})

const updateUserZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    designation: z.string().optional(),
    company: z.string().optional(),
    manualBreak: z.boolean().optional(),
    images: z.array(z.string()).optional(),
  }),
})

const createOrUpdateLeaveBalanceZodSchema = z.object({
  body: z.object({
    balances: z.array(z.object({
      type: z.enum(['earn', 'sick', 'casual', 'wp']).optional(),
      balance: z.number(),
    })),
  }),
})

export const UserValidations = { createUserZodSchema, updateUserZodSchema, createOrUpdateLeaveBalanceZodSchema }
