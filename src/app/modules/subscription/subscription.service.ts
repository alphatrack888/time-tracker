import { StatusCodes } from 'http-status-codes'
import { Types } from 'mongoose'
import ApiError from '../../../errors/ApiError'
import { logger } from '../../../shared/logger'
import { User } from '../user/user.model'
import { stripeService } from './stripe.service'
import { Subscription } from './subscription.model'
import { SubscriptionPlan } from './subscription-plan.model'
import {
  ISubscription,
  ISubscriptionPlan,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  SubscriptionResponse,
  TrialInfo,
  SubscriptionStatus,
} from './subscription.interface'
import Stripe from 'stripe'
import { emailNotificationService } from './email-notification.service'



class SubscriptionService {
  // Get all available subscription plans
  async getAvailablePlans(userType?: string): Promise<ISubscriptionPlan[]> {
    try {
      const query: any = { isActive: true }

      if (userType) {
        query.userTypes = { $in: [userType] }
      }

      const plans = await SubscriptionPlan.find(query).sort({ priority: 1, price: 1 })
      return plans
    } catch (error) {
      logger.error('Error fetching subscription plans:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch subscription plans')
    }
  }

  // Get plan by ID
  async getPlanById(planId: string): Promise<ISubscriptionPlan> {
    try {
      const plan = await SubscriptionPlan.findById(planId)
      if (!plan) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription plan not found')
      }
      return plan
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error fetching subscription plan:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch subscription plan')
    }
  }

  // Check trial eligibility
  async checkTrialEligibility(userId: string): Promise<TrialInfo> {
    try {
      const existingSubscription = await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        hasUsedTrial: true,
      })

      const isEligible = !existingSubscription

      return {
        isEligible,
        hasUsedTrial: !!existingSubscription,
        trialDays: 10, // Default trial period
        reason: isEligible ? undefined : 'User has already used their free trial',
      }
    } catch (error) {
      logger.error('Error checking trial eligibility:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to check trial eligibility')
    }
  }

  // Create subscription
  async createSubscription(
    userId: string,
    request: CreateSubscriptionRequest,
  ): Promise<SubscriptionResponse> {
    try {
      // Validate user exists
      const user = await User.findById(userId).select('+email')
      if (!user) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
      }

      // Validate plan exists
      const plan = await this.getPlanById(request.planId)

      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findActiveByUserId(userId)
      if (existingSubscription) {
        throw new ApiError(StatusCodes.CONFLICT, 'User already has an active subscription')
      }

      // Check trial eligibility
      const trialInfo = await this.checkTrialEligibility(userId)

      // Create or get Stripe customer
      let stripeCustomerId: string
      const existingCustomer = await Subscription.findOne({ userId }).select('stripeCustomerId')

      if (existingCustomer?.stripeCustomerId) {
        stripeCustomerId = existingCustomer.stripeCustomerId
      } else {
        const stripeCustomer = await stripeService.createCustomer(
          user.email!,
          user.name || user.email,
          { userId: userId.toString() },
        )
        stripeCustomerId = stripeCustomer.id
      }

      // Attach payment method if provided
      if (request.paymentMethodId) {
        await stripeService.attachPaymentMethod(request.paymentMethodId, stripeCustomerId)
        await stripeService.setDefaultPaymentMethod(stripeCustomerId, request.paymentMethodId)
      }

      // Create Stripe subscription
      const stripeSubscription = await stripeService.createSubscription({
        customerId: stripeCustomerId,
        priceId: plan.stripePriceId,
        // trialPeriodDays: trialInfo.isEligible ? plan.trialPeriodDays : undefined,
        paymentMethodId: request.paymentMethodId,
        metadata: {
          userId: userId.toString(),
          planId: request.planId,
        },
      })

      const stripeSubscriptionLineItems = stripeSubscription.items.data.find((item) => item.object === 'subscription_item') as Stripe.SubscriptionItem


      // Create local subscription record
      const subscription = new Subscription({
        userId: new Types.ObjectId(userId),
        planId: new Types.ObjectId(request.planId),
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: plan.stripePriceId,
        status: stripeSubscription.status,
        price: stripeSubscriptionLineItems.price.unit_amount ? stripeSubscriptionLineItems.price.unit_amount / 100 : 0,
        currentPeriodStart: new Date(stripeSubscriptionLineItems.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscriptionLineItems.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        hasUsedTrial: trialInfo.isEligible,
        metadata: new Map(Object.entries(stripeSubscription.metadata || {})),
      })

      await subscription.save()

      // Update user profile with subscription info
      await User.findByIdAndUpdate(userId, {
        stripeCustomerId,
        subscriptionStatus: stripeSubscription.status,
        subscriptionTier: this.getSubscriptionTier(plan.name),
        trialUsed: trialInfo.isEligible,
        subscriptionExpiresAt: new Date(stripeSubscriptionLineItems.current_period_end * 1000),
      })

      // Send welcome email
      await emailNotificationService.sendSubscriptionWelcomeEmail(
        subscription,
        plan,
        !!stripeSubscription.trial_start
      )



      logger.info(`Subscription created for user ${userId}: ${subscription._id}`)

      return {
        subscription: await subscription.populate(['planId']),
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error creating subscription:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create subscription')
    }
  }

  // Get user's current subscription
  async getUserSubscription(userId: string): Promise<ISubscription | null> {
    try {
      const subscription = await Subscription.findActiveByUserId(userId)
      return subscription || null
    } catch (error) {
      logger.error('Error fetching user subscription:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch subscription')
    }
  }

  // Update subscription (change plan)
  async updateSubscription(
    userId: string,
    subscriptionId: string,
    request: UpdateSubscriptionRequest,
  ): Promise<ISubscription> {
    try {
      // Find existing subscription
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId: new Types.ObjectId(userId),
      })

      if (!subscription) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription not found')
      }

      const updateParams: any = {}

      // Handle plan change
      if (request.planId) {
        const newPlan = await this.getPlanById(request.planId)

        // Get current Stripe subscription to find subscription item ID
        const stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId)
        const subscriptionItemId = stripeSubscription.items.data[0].id

        // Update Stripe subscription with correct item ID
        await stripeService.updateSubscription(subscription.stripeSubscriptionId, {
          items: [
            {
              id: subscriptionItemId, // Use subscription item ID, not subscription ID
              price: newPlan.stripePriceId,
            },
          ],
          proration_behavior: 'create_prorations', // This handles automatic proration
        })

        updateParams.planId = new Types.ObjectId(request.planId)
        updateParams.stripePriceId = newPlan.stripePriceId

        // Get updated subscription from Stripe to get the new price
        const updatedStripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId)
        updateParams.price = updatedStripeSubscription.items.data[0].price.unit_amount ? updatedStripeSubscription.items.data[0].price.unit_amount / 100 : 0

        // Update user profile with new subscription tier
        await User.findByIdAndUpdate(userId, {
          subscriptionTier: this.getSubscriptionTier(newPlan.name),
        })

        // Send plan change notification email
        const { emailNotificationService } = await import('./email-notification.service')
        await emailNotificationService.sendPlanChangeEmail(
          subscription,
          newPlan,
          stripeSubscription.items.data[0].price
        )
      }

      // Handle cancellation
      if (request.cancelAtPeriodEnd !== undefined) {
        await stripeService.updateSubscription(subscription.stripeSubscriptionId, {
          cancel_at_period_end: request.cancelAtPeriodEnd,
        })

        updateParams.cancelAtPeriodEnd = request.cancelAtPeriodEnd
        if (request.cancelAtPeriodEnd) {
          updateParams.canceledAt = new Date()
        }
      }

      // Update local subscription
      const updatedSubscription = await Subscription.findByIdAndUpdate(
        subscriptionId,
        updateParams,
        { new: true },
      ).populate(['planId'])

      logger.info(`Subscription updated: ${subscriptionId}`)
      return updatedSubscription!
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error updating subscription:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update subscription')
    }
  }

  // Cancel subscription
  async cancelSubscription(
    userId: string,
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
  ): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId: new Types.ObjectId(userId),
      })

      if (!subscription) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription not found')
      }

      // Cancel in Stripe
      await stripeService.cancelSubscription(subscription.stripeSubscriptionId, cancelAtPeriodEnd)

      // Update local subscription
      const updateData: any = {
        cancelAtPeriodEnd,
        canceledAt: new Date(),
      }

      if (!cancelAtPeriodEnd) {
        updateData.status = 'canceled'
        updateData.endedAt = new Date()
      }

      const updatedSubscription = await Subscription.findByIdAndUpdate(
        subscriptionId,
        updateData,
        { new: true },
      ).populate(['planId'])

      logger.info(`Subscription canceled: ${subscriptionId}`)
      return updatedSubscription!
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error canceling subscription:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to cancel subscription')
    }
  }

  // Get subscription status
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const subscription = await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      }).populate('planId')

      if (!subscription) {
        return {
          isActive: false,
          isTrialing: false,
          isPastDue: false,
          isCanceled: false,
          daysUntilExpiry: 0,
        }
      }

      const now = new Date()
      const endDate = subscription.currentPeriodEnd
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Ensure planId is populated, if not fetch it separately
      let currentPlan: ISubscriptionPlan | undefined
      if (
        subscription.planId &&
        typeof subscription.planId === 'object' &&
        'name' in subscription.planId &&
        'description' in subscription.planId &&
        'price' in subscription.planId
      ) {
        // planId is properly populated with plan data
        currentPlan = subscription.planId as unknown as ISubscriptionPlan
      } else {
        // Fallback: fetch the plan separately if not populated
        currentPlan = await this.getPlanById(subscription.planId.toString())
      }

      return {
        isActive: ['active', 'trialing'].includes(subscription.status),
        isTrialing: subscription.status === 'trialing',
        isPastDue: subscription.status === 'past_due',
        isCanceled: subscription.status === 'canceled',
        daysUntilExpiry: Math.max(0, daysUntilExpiry),
        currentPlan,
      }
    } catch (error) {
      logger.error('Error getting subscription status:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get subscription status')
    }
  }

  // Create checkout session
  async createCheckoutSession(
    userId: string,
    planId: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<{ sessionId: string; url: string }> {
    try {
      const user = await User.findById(userId).select('+email')
      if (!user) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
      }

      const plan = await this.getPlanById(planId)
      await this.checkTrialEligibility(userId)

      const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/['"]/g, '').replace(/\/$/, '').trim()
      const finalSuccessUrl = successUrl || `${baseUrl}/subscription-success`
      const finalCancelUrl = cancelUrl || `${baseUrl}/subscription`

      // Create or get Stripe customer
      let stripeCustomerId: string
      const existingCustomer = await Subscription.findOne({ userId }).select('stripeCustomerId')

      if (existingCustomer?.stripeCustomerId) {
        stripeCustomerId = existingCustomer.stripeCustomerId
      } else {
        const stripeCustomer = await stripeService.createCustomer(
          user.email!,
          user.name || user.email,
          { userId: userId.toString() },
        )
        stripeCustomerId = stripeCustomer.id
      }

      const session = await stripeService.createCheckoutSession({
        customerId: stripeCustomerId,
        priceId: plan.stripePriceId,
        successUrl: finalSuccessUrl,
        cancelUrl: finalCancelUrl,
        // trialPeriodDays: trialInfo.isEligible ? plan.trialPeriodDays : undefined,
        metadata: {
          userId: userId.toString(),
          planId,
        },
      })

      return {
        sessionId: session.id,
        url: session.url!,
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error creating checkout session:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create checkout session')
    }
  }

  // Admin: Create subscription plan
  async createSubscriptionPlan(planData: Omit<ISubscriptionPlan, '_id' | 'createdAt' | 'updatedAt'>): Promise<ISubscriptionPlan> {
    try {
      // Create Stripe product
      const stripeProduct = await stripeService.createProduct({
        name: planData.name,
        description: planData.description,
        metadata: {
          // userTypes: planData.userTypes.join(','),
          // maxUsers: planData.maxUsers.toString(),
          // maxTrucks: planData.maxTrucks.toString(),
        },
      })

      // Create Stripe price
      const stripePrice = await stripeService.createPrice({
        productId: stripeProduct.id,
        unitAmount: planData.price * 100, // Convert to cents
        currency: planData.currency,
        interval: planData.interval,
        intervalCount: planData.intervalCount,
        metadata: {
          planName: planData.name,
        },
      })

      // Create local plan
      const plan = new SubscriptionPlan({
        ...planData,
        stripeProductId: stripeProduct.id,
        stripePriceId: stripePrice.id,
      })

      await plan.save()

      logger.info(`Subscription plan created: ${plan._id}`)
      return plan
    } catch (error) {
      console.log(error)
      logger.error('Error creating subscription plan:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create subscription plan')
    }
  }

  // Admin: Update subscription plan
  async updateSubscriptionPlan(
    planId: string,
    updateData: Partial<ISubscriptionPlan>,
  ): Promise<ISubscriptionPlan> {
    try {
      const plan = await SubscriptionPlan.findById(planId)
      if (!plan) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription plan not found')
      }

      // Update Stripe product if name or description changed
      if (updateData.name || updateData.description) {
        await stripeService.updateProduct(plan.stripeProductId, {
          name: updateData.name || plan.name,
          description: updateData.description || plan.description,
        })
      }

      // Create new Stripe price if price changed
      if (updateData.price && updateData.price !== plan.price) {
        const newStripePrice = await stripeService.createPrice({
          productId: plan.stripeProductId,
          unitAmount: updateData.price * 100,
          currency: updateData.currency || plan.currency,
          interval: updateData.interval || plan.interval,
          intervalCount: updateData.intervalCount || plan.intervalCount,
        })

        // Archive old price
        await stripeService.archivePrice(plan.stripePriceId)

        updateData.stripePriceId = newStripePrice.id
      }

      const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(planId, updateData, { new: true })

      logger.info(`Subscription plan updated: ${planId}`)
      return updatedPlan!
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error updating subscription plan:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update subscription plan')
    }
  }

  // Admin: Delete subscription plan
  async deleteSubscriptionPlan(planId: string): Promise<ISubscriptionPlan> {
    try {
      const plan = await SubscriptionPlan.findById(planId)
      if (!plan) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription plan not found')
      }

      // Archive in Stripe instead of hard delete to avoid issues with active subscriptions
      await stripeService.archivePrice(plan.stripePriceId)
      await stripeService.archiveProduct(plan.stripeProductId)

      // Delete from local DB
      const deletedPlan = await SubscriptionPlan.findByIdAndDelete(planId)

      logger.info(`Subscription plan deleted: ${planId}`)
      return deletedPlan!
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error deleting subscription plan:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to delete subscription plan')
    }
  }


  // Get subscription analytics
  async getSubscriptionAnalytics(filters?: {
    startDate?: Date
    endDate?: Date
    planId?: string
    status?: string
  }): Promise<any> {
    try {
      const matchStage: any = {}

      if (filters?.startDate || filters?.endDate) {
        matchStage.createdAt = {}
        if (filters.startDate) matchStage.createdAt.$gte = filters.startDate
        if (filters.endDate) matchStage.createdAt.$lte = filters.endDate
      }

      if (filters?.planId) {
        matchStage.planId = new Types.ObjectId(filters.planId)
      }

      if (filters?.status) {
        matchStage.status = filters.status
      }

      const analytics = await Subscription.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSubscriptions: { $sum: 1 },
            activeSubscriptions: {
              $sum: { $cond: [{ $in: ['$status', ['active', 'trialing']] }, 1, 0] }
            },
            trialingSubscriptions: {
              $sum: { $cond: [{ $eq: ['$status', 'trialing'] }, 1, 0] }
            },
            canceledSubscriptions: {
              $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] }
            },
            pastDueSubscriptions: {
              $sum: { $cond: [{ $eq: ['$status', 'past_due'] }, 1, 0] }
            },
          }
        }
      ])

      // Calculate MRR (Monthly Recurring Revenue)
      const mrrData = await Subscription.aggregate([
        {
          $match: {
            status: { $in: ['active', 'trialing'] },
            ...matchStage
          }
        },
        {
          $lookup: {
            from: 'subscriptionplans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan'
          }
        },
        { $unwind: '$plan' },
        {
          $group: {
            _id: null,
            monthlyRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$plan.interval', 'month'] },
                  '$plan.price',
                  { $divide: ['$plan.price', 12] } // Convert yearly to monthly
                ]
              }
            }
          }
        }
      ])

      const result = analytics[0] || {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        trialingSubscriptions: 0,
        canceledSubscriptions: 0,
        pastDueSubscriptions: 0,
      }

      result.monthlyRevenue = mrrData[0]?.monthlyRevenue || 0
      result.churnRate = result.totalSubscriptions > 0
        ? (result.canceledSubscriptions / result.totalSubscriptions * 100).toFixed(2)
        : 0

      return result
    } catch (error) {
      logger.error('Error getting subscription analytics:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get subscription analytics')
    }
  }

  // Retry failed payments
  async retryFailedPayment(subscriptionId: string): Promise<void> {
    try {
      const subscription = await Subscription.findById(subscriptionId)
      if (!subscription) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription not found')
      }

      // Get latest invoice from Stripe
      const stripeSubscription = await stripeService.getSubscriptionExpanded(subscription.stripeSubscriptionId)

      if (stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice === 'object') {
        const invoice = stripeSubscription.latest_invoice

        // Retry payment on the invoice
        await stripeService.retryInvoicePayment(invoice.id as string)

        logger.info(`Payment retry initiated for subscription: ${subscriptionId}`)
      }
    } catch (error) {
      logger.error('Error retrying failed payment:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to retry payment')
    }
  }

  // Pause subscription (for temporary suspension)
  async pauseSubscription(userId: string, subscriptionId: string): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId: new Types.ObjectId(userId),
      })

      if (!subscription) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription not found')
      }

      // Pause in Stripe
      await stripeService.pauseSubscription(subscription.stripeSubscriptionId)

      // Update local subscription
      const updatedSubscription = await Subscription.findByIdAndUpdate(
        subscriptionId,
        { status: 'paused' },
        { new: true }
      ).populate(['planId'])

      logger.info(`Subscription paused: ${subscriptionId}`)
      return updatedSubscription!
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error pausing subscription:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to pause subscription')
    }
  }

  // Resume paused subscription
  async resumeSubscription(userId: string, subscriptionId: string): Promise<ISubscription> {
    try {
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId: new Types.ObjectId(userId),
      })

      if (!subscription) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription not found')
      }

      // Resume in Stripe
      await stripeService.resumeSubscription(subscription.stripeSubscriptionId)

      // Update local subscription
      const updatedSubscription = await Subscription.findByIdAndUpdate(
        subscriptionId,
        { status: 'active' },
        { new: true }
      ).populate(['planId'])

      logger.info(`Subscription resumed: ${subscriptionId}`)
      return updatedSubscription!
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error('Error resuming subscription:', error)
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to resume subscription')
    }
  }

  // Helper method to determine subscription tier
  private getSubscriptionTier(planName: string): string {
    const name = planName.toLowerCase()
    if (name.includes('enterprise') || name.includes('pro')) {
      return 'premium'
    } else if (name.includes('basic') || name.includes('starter')) {
      return 'basic'
    }
    return 'free'
  }
}

export const subscriptionService = new SubscriptionService()