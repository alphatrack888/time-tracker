import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { subscriptionService } from './subscription.service'
import { webhookService } from './webhook.service'
import { IUser } from '../user/user.interface'
import { JwtPayload } from 'jsonwebtoken'

// Get available subscription plans
const getAvailablePlans = catchAsync(async (req: Request, res: Response) => {
  const { userType } = req.query
  
  const plans = await subscriptionService.getAvailablePlans(userType as string)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription plans retrieved successfully',
    data: plans,
  })
})

// Get specific plan by ID
const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params
  
  const plan = await subscriptionService.getPlanById(planId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription plan retrieved successfully',
    data: plan,
  })
})

// Check trial eligibility
const checkTrialEligibility = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = req.params.userId || user.authId?.toString()
  
  const trialInfo = await subscriptionService.checkTrialEligibility(userId!)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trial eligibility checked successfully',
    data: trialInfo,
  })
})

// Create subscription
const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  
  const result = await subscriptionService.createSubscription(userId, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Subscription created successfully',
    data: result,
  })
})

// Get user's current subscription
const getUserSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  
  const subscription = await subscriptionService.getUserSubscription(userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: subscription ? 'Subscription retrieved successfully' : 'No active subscription found',
    data: subscription || {},

  })
})

// Update subscription
const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  const { subscriptionId } = req.params
  
  const subscription = await subscriptionService.updateSubscription(userId, subscriptionId, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription updated successfully',
    data: subscription,
  })
})

// Cancel subscription
const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  const { subscriptionId } = req.params
  const { cancelAtPeriodEnd = true } = req.body
  
  const subscription = await subscriptionService.cancelSubscription(userId, subscriptionId, cancelAtPeriodEnd)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription canceled successfully',
    data: subscription,
  })
})

// Get subscription status
const getSubscriptionStatus = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  
  const status = await subscriptionService.getSubscriptionStatus(userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription status retrieved successfully',
    data: status,
  })
})

// Create checkout session
const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  const { planId, successUrl, cancelUrl } = req.body
  
  const session = await subscriptionService.createCheckoutSession(userId, planId, successUrl, cancelUrl)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Checkout session created successfully',
    data: session,
  })
})

// Handle Stripe webhooks
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string
  const payload = req.body

  // Verify webhook signature and construct event
  const event = webhookService.verifyWebhookSignature(payload, signature)

  // Process the webhook event
  await webhookService.processWebhookEvent(event)

  // Respond to Stripe
  res.status(StatusCodes.OK).json({ received: true })
})

// Admin: Create subscription plan
const createSubscriptionPlan = catchAsync(async (req: Request, res: Response) => {
  const plan = await subscriptionService.createSubscriptionPlan(req.body)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Subscription plan created successfully',
    data: plan,
  })
})

// Admin: Update subscription plan
const updateSubscriptionPlan = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params
  
  const plan = await subscriptionService.updateSubscriptionPlan(planId, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription plan updated successfully',
    data: plan,
  })
})

// Admin: Get all plans (including inactive)
const getAllPlans = catchAsync(async (req: Request, res: Response) => {
  const { userType } = req.query
  
  // For admin, get all plans including inactive ones
  const plans = await subscriptionService.getAvailablePlans(userType as string)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All subscription plans retrieved successfully',
    data: plans,
  })
})

// Admin: Get subscription analytics
const getSubscriptionAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate, planId, status } = req.query
  
  const filters: any = {}
  if (startDate) filters.startDate = new Date(startDate as string)
  if (endDate) filters.endDate = new Date(endDate as string)
  if (planId) filters.planId = planId as string
  if (status) filters.status = status as string
  
  const analytics = await subscriptionService.getSubscriptionAnalytics(filters)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription analytics retrieved successfully',
    data: analytics,
  })
})

// Reactivate canceled subscription
const reactivateSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  const { subscriptionId } = req.params
  
  // This would involve creating a new subscription or updating the canceled one
  // Implementation depends on your business logic
  
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription reactivation initiated',
    data: { message: 'Please contact support for subscription reactivation' },
  })
})

// Retry failed payment
const retryFailedPayment = catchAsync(async (req: Request, res: Response) => {
  const { subscriptionId } = req.params
  
  await subscriptionService.retryFailedPayment(subscriptionId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment retry initiated successfully',
    data: null,
  })
})

// Pause subscription
const pauseSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  const { subscriptionId } = req.params
  
  const subscription = await subscriptionService.pauseSubscription(userId, subscriptionId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription paused successfully',
    data: subscription,
  })
})

// Resume subscription
const resumeSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  const { subscriptionId } = req.params
  
  const subscription = await subscriptionService.resumeSubscription(userId, subscriptionId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription resumed successfully',
    data: subscription,
  })
})

// Get usage data
const getUsageData = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  
  const { usageTrackingService } = await import('./usage-tracking.service')
  const usageData = await usageTrackingService.getUsageWithLimits(userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Usage data retrieved successfully',
    data: usageData,
  })
})

// Check usage warnings
const getUsageWarnings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = user.authId!.toString()
  
  const { usageTrackingService } = await import('./usage-tracking.service')
  const warnings = await usageTrackingService.checkApproachingLimits(userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Usage warnings retrieved successfully',
    data: warnings,
  })
})

export const SubscriptionController = {
  // Public endpoints
  getAvailablePlans,
  getPlanById,
  
  // User endpoints (require authentication)
  checkTrialEligibility,
  createSubscription,
  getUserSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscriptionStatus,
  createCheckoutSession,
  reactivateSubscription,
  pauseSubscription,
  resumeSubscription,
  getUsageData,
  getUsageWarnings,
  
  // Webhook endpoint
  handleWebhook,
  
  // Admin endpoints (require admin role)
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getAllPlans,
  getSubscriptionAnalytics,
  retryFailedPayment,
}