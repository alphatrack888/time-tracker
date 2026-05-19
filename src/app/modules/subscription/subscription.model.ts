import mongoose, { Schema, model } from 'mongoose'
import { ISubscription, SubscriptionModel } from './subscription.interface'

const subscriptionSchema = new Schema<ISubscription, SubscriptionModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      // unique: true,
    },
    stripePriceId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused',
      ],
      required: true,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    trialStart: {
      type: Date,
      default: null,
    },
    trialEnd: {
      type: Date,
      default: null,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    hasUsedTrial: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
    // Payment tracking
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    nextPaymentDate: {
      type: Date,
      default: null,
    },
    paymentFailureCount: {
      type: Number,
      default: 0,
    },
    // Idempotency for webhooks
    lastWebhookEventId: {
      type: String,
      default: null,
    },
    // Additional production fields
    pausedAt: {
      type: Date,
      default: null,
    },
    resumedAt: {
      type: Date,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    // Fraud prevention
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    fraudFlags: [{
      type: String,
      enum: ['multiple_trials', 'suspicious_payment', 'chargeback_history', 'high_velocity'],
    }],
  },
  {
    timestamps: true,
  },
)

// Indexes for efficient queries
subscriptionSchema.index({ userId: 1 })
subscriptionSchema.index({ stripeSubscriptionId: 1 })
subscriptionSchema.index({ stripeCustomerId: 1 })
subscriptionSchema.index({ status: 1 })
subscriptionSchema.index({ currentPeriodEnd: 1 })
subscriptionSchema.index({ trialEnd: 1 })

// Compound indexes
subscriptionSchema.index({ userId: 1, status: 1 })

// Static methods
subscriptionSchema.statics.findActiveByUserId = function(userId: string) {
  return this.findOne({
    userId,
    status: { $in: ['active', 'trialing'] },
  }).populate('planId')
}

subscriptionSchema.statics.findByStripeId = function(stripeSubscriptionId: string) {
  return this.findOne({ stripeSubscriptionId }).populate(['userId', 'planId'])
}

export const Subscription = model<ISubscription, SubscriptionModel>(
  'Subscription',
  subscriptionSchema,
)