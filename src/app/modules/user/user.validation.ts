import { z } from 'zod'
import { USER_ROLES } from '../../../enum/user'
import { isValidTimezone } from '../../../helpers/timezoneHelper'

const timezoneZodField = z
  .string()
  .refine(isValidTimezone, { message: 'timezone must be a valid IANA timezone identifier (e.g. "America/New_York")' })
  .optional()

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
    manualBreak: z.boolean().optional(),
    images: z.array(z.string()).optional(),
    // Mainly meaningful for COMPANY-role users — see user.interface.ts and
    // the Phase 6 daily overtime sweep, which uses this to determine that
    // company's local calendar-day boundaries.
    timezone: timezoneZodField,
  }),
})

const adminUpdateUserZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    designation: z.string().optional(),
    manualBreak: z.boolean().optional(),
    images: z.array(z.string()).optional(),
    timezone: timezoneZodField,
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

export const UserValidations = { createUserZodSchema, updateUserZodSchema, adminUpdateUserZodSchema, createOrUpdateLeaveBalanceZodSchema }
