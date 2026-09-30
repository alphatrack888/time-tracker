import { z } from 'zod';

const startTimerZodSchema = z.object({
  body: z.object({
    project: z.string().optional(),
    location: z.object({
      lat: z.number({ required_error: 'Latitude is required' }),
      lng: z.number({ required_error: 'Longitude is required' }),
    }).optional(),
  }),
});

const pauseTimerZodSchema = z.object({
  body: z.object({
    location: z.object({
      lat: z.number({ required_error: 'Latitude is required' }),
      lng: z.number({ required_error: 'Longitude is required' }),
    }).optional(),
  }),
});

const resumeTimerZodSchema = z.object({
  body: z.object({
    location: z.object({
      lat: z.number({ required_error: 'Latitude is required' }),
      lng: z.number({ required_error: 'Longitude is required' }),
    }).optional(),
  }),
});

const stopTimerZodSchema = z.object({
  body: z.object({
    location: z.object({
      lat: z.number({ required_error: 'Latitude is required' }),
      lng: z.number({ required_error: 'Longitude is required' }),
    }).optional(),
  }),
});

const getDailySummaryZodSchema = z.object({
  query: z.object({
    date: z.string({ required_error: 'Date is required' }),
    project: z.string().optional(),
  }),
});

const addPeriodicLocationZodSchema = z.object({
  body: z.object({
    sessionId: z.string({ required_error: 'Session ID is required' }),
    location: z.object({
      lat: z.number({ required_error: 'Latitude is required' }),
      lng: z.number({ required_error: 'Longitude is required' }),
    }),
  }),
});

const getSessionLocationsZodSchema = z.object({
  params: z.object({
    sessionId: z.string({ required_error: 'Session ID is required' }),
  }),
});

const getLocationsByDateZodSchema = z.object({
  query: z.object({
    date: z.string({ required_error: 'Date is required' }),
    project: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const getMonthlyReportZodSchema = z.object({
  query: z.object({
    month: z
      .string({ required_error: 'Month is required' })
      .regex(/^[0-9]{4}-[0-9]{2}$/i, 'Month must be in YYYY-MM format'),
    employee: z.string().optional(),
    project: z.string().optional(),
    template: z.enum(['default', 'timesheet', 'comprehensive']).optional(),
    // Was accepted and used by the controller without ever being validated
    // here — tightened while adding `format` alongside it.
    lang: z.enum(['en', 'de']).optional(),
    format: z.enum(['pdf', 'excel']).optional(),
  }),
});

const dateStringSchema = (message: string) => z.string({ required_error: message }).regex(/^\d{4}-\d{2}-\d{2}$/, `${message} must be in YYYY-MM-DD format`);

const getAttendanceReportZodSchema = z.object({
  query: z.object({
    startDate: dateStringSchema('startDate is required'),
    endDate: dateStringSchema('endDate is required'),
    employee: z.string().optional(),
    project: z.string().optional(),
    format: z.enum(['pdf', 'excel']).optional(),
    lang: z.enum(['en', 'de']).optional(),
  }),
});

const requestAsyncAttendanceReportZodSchema = z.object({
  body: z.object({
    startDate: dateStringSchema('startDate is required'),
    endDate: dateStringSchema('endDate is required'),
    project: z.string().optional(),
    format: z.enum(['pdf', 'excel']).optional(),
    lang: z.enum(['en', 'de']).optional(),
    // ADMIN/SUPER_ADMIN only — scopes the report to one company. Ignored
    // for COMPANY requesters (see reportjob.service.ts), so no role check
    // is needed here.
    company: z.string().optional(),
  }),
});

const listReportJobsZodSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'page must be a positive integer').optional(),
    limit: z.string().regex(/^\d+$/, 'limit must be a positive integer').optional(),
  }),
});

export const TimeTrackerValidations = {
  startTimerZodSchema,
  pauseTimerZodSchema,
  resumeTimerZodSchema,
  stopTimerZodSchema,
  getDailySummaryZodSchema,
  addPeriodicLocationZodSchema,
  getSessionLocationsZodSchema,
  getLocationsByDateZodSchema,
  getMonthlyReportZodSchema,
  getAttendanceReportZodSchema,
  requestAsyncAttendanceReportZodSchema,
  listReportJobsZodSchema,
};