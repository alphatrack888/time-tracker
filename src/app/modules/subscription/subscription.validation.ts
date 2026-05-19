import { z } from 'zod'

// Subscription Plan Validation
export const createSubscriptionPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Plan name is required').max(100, 'Plan name too long'),
    description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
    price: z.number().min(0, 'Price must be non-negative'),
    currency: z.string().length(3, 'Currency must be 3 characters').default('usd'),
    interval: z.enum(['month', 'year'], {
      errorMap: () => ({ message: 'Interval must be month or year' }),
    }),
    paymentUrl: z.string().url(),
    // intervalCount: z.number().min(1, 'Interval count must be at least 1').default(1),
    // trialPeriodDays: z.number().min(0, 'Trial period must be non-negative').default(10),
    features: z.array(z.string().min(1, 'Feature cannot be empty')).min(1, 'At least one feature is required'),
    // maxUsers: z.number().min(1, 'Max users must be at least 1').default(1),
    // maxTrucks: z.number().min(1, 'Max trucks must be at least 1').default(1),
    // userTypes: z.array(
    //   z.enum(['driver', 'company', 'mechanic', 'cook', 'fuel_provider'], {
    //     errorMap: () => ({ message: 'Invalid user type' }),
    //   }),
    // ).min(1, 'At least one user type is required'),
    priority: z.number().default(0),
  }),
})

export const updateSubscriptionPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Plan name is required').max(100, 'Plan name too long').optional(),
    description: z.string().min(1, 'Description is required').max(500, 'Description too long').optional(),
    features: z.array(z.string().min(1, 'Feature cannot be empty')).min(1, 'At least one feature is required').optional(),
    maxUsers: z.number().min(1, 'Max users must be at least 1').optional(),
    maxTrucks: z.number().min(1, 'Max trucks must be at least 1').optional(),
    isActive: z.boolean().optional(),
    priority: z.number().optional(),
  }),
})

// Subscription Validation
export const createSubscriptionSchema = z.object({
  body: z.object({
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format'),
    paymentMethodId: z.string().optional(),
    couponId: z.string().optional(),
  }),
})

export const updateSubscriptionSchema = z.object({
  body: z.object({
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format').optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  }),
})

// Checkout Session Validation
export const createCheckoutSessionSchema = z.object({
  body: z.object({
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format'),
  }),
})

// Query Validation
export const getPlansQuerySchema = z.object({
  query: z.object({
    userType: z.enum(['driver', 'company', 'mechanic', 'cook', 'fuel_provider']).optional(),
  }),
})

// Params Validation
export const subscriptionParamsSchema = z.object({
  params: z.object({
    subscriptionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid subscription ID format'),
  }),
})

export const planParamsSchema = z.object({
  params: z.object({
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format'),
  }),
})

// Webhook Validation
export const webhookHeaderSchema = z.object({
  headers: z.object({
    'stripe-signature': z.string().min(1, 'Stripe signature is required'),
  }),
})

// Trial Eligibility Validation
export const checkTrialEligibilitySchema = z.object({
  params: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format').optional(),
  }),
})

// Admin validation for bulk operations
export const bulkUpdatePlansSchema = z.object({
  body: z.object({
    planIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format')).min(1, 'At least one plan ID is required'),
    updates: z.object({
      isActive: z.boolean().optional(),
      priority: z.number().optional(),
    }),
  }),
})

// Subscription analytics validation
export const subscriptionAnalyticsSchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format').optional(),
    status: z.enum(['active', 'trialing', 'canceled', 'past_due', 'unpaid']).optional(),
  }),
})

// Payment method validation
export const attachPaymentMethodSchema = z.object({
  body: z.object({
    paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  }),
})

// Coupon validation
export const applyCouponSchema = z.object({
  body: z.object({
    couponCode: z.string().min(1, 'Coupon code is required').max(50, 'Coupon code too long'),
  }),
})

// Export all schemas for easy import
export const subscriptionValidation = {
  createSubscriptionPlan: createSubscriptionPlanSchema,
  updateSubscriptionPlan: updateSubscriptionPlanSchema,
  createSubscription: createSubscriptionSchema,
  updateSubscription: updateSubscriptionSchema,
  createCheckoutSession: createCheckoutSessionSchema,
  getPlansQuery: getPlansQuerySchema,
  subscriptionParams: subscriptionParamsSchema,
  planParams: planParamsSchema,
  webhookHeader: webhookHeaderSchema,
  checkTrialEligibility: checkTrialEligibilitySchema,
  bulkUpdatePlans: bulkUpdatePlansSchema,
  subscriptionAnalytics: subscriptionAnalyticsSchema,
  attachPaymentMethod: attachPaymentMethodSchema,
  applyCoupon: applyCouponSchema,
}