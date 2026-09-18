import { logger } from '../../../shared/logger'
import { dispatchEmail } from '../../../helpers/appEvents'
import { emailTemplate } from '../../../shared/emailTemplate'
import { User } from '../user/user.model'
import { ISubscription, ISubscriptionPlan } from './subscription.interface'
import Stripe from 'stripe'

class EmailNotificationService {
  // Send welcome email when subscription is created
  async sendSubscriptionWelcomeEmail(
    subscription: ISubscription,
    plan: ISubscriptionPlan,
    isTrialing: boolean = false
  ): Promise<void> {
    try {
      const user = await User.findById(subscription.userId).select('+email')
      if (!user || !user.email) {
        logger.warn(`No email found for user: ${subscription.userId}`)
        return
      }

      const emailData = emailTemplate.subscriptionWelcome({
        name: user.name || 'Valued Customer',
        email: user.email,
        planName: plan.name,
        planPrice: plan.price,
        planInterval: plan.interval,
        isTrialing,
        // trialDays: plan.trialPeriodDays,
        trialEndDate: subscription.trialEnd || undefined,
        features: plan.features,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      })

      dispatchEmail(emailData)
      logger.info(`Subscription welcome email queued for: ${user.email}`)
    } catch (error) {
      logger.error('Error sending subscription welcome email:', error)
    }
  }

  // Send trial ending reminder
  async sendTrialEndingEmail(
    subscription: ISubscription,
    plan: ISubscriptionPlan,
    daysLeft: number
  ): Promise<void> {
    try {
      const user = await User.findById(subscription.userId).select('+email')
      if (!user || !user.email) return

      const emailData = emailTemplate.trialEnding({
        name: user.name || 'Valued Customer',
        email: user.email,
        planName: plan.name,
        daysLeft,
        trialEndDate: subscription.trialEnd!,
        planPrice: plan.price,
        planInterval: plan.interval,
        upgradeUrl: `${process.env.FRONTEND_URL}/subscription/plans`,
      })

      dispatchEmail(emailData)
      logger.info(`Trial ending email queued for: ${user.email}`)
    } catch (error) {
      logger.error('Error sending trial ending email:', error)
    }
  }

  // Send payment success email
  async sendPaymentSuccessEmail(
    subscription: ISubscription,
    invoice: Stripe.Invoice
  ): Promise<void> {
    try {
      const user = await User.findById(subscription.userId).select('+email')
      if (!user || !user.email) return

      const emailData = emailTemplate.paymentSuccess({
        name: user.name || 'Valued Customer',
        email: user.email,
        invoiceNumber: invoice.number || 'N/A',
        amount: (invoice.amount_paid / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        paymentDate: new Date(invoice.status_transitions.paid_at! * 1000),
        nextPaymentDate: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
        invoiceUrl: invoice.hosted_invoice_url || undefined,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      })

      dispatchEmail(emailData)
      logger.info(`Payment success email queued for: ${user.email}`)
    } catch (error) {
      logger.error('Error sending payment success email:', error)
    }
  }

  // Send payment failed email
  async sendPaymentFailedEmail(
    subscription: ISubscription,
    invoice: Stripe.Invoice,
    attemptCount: number
  ): Promise<void> {
    try {
      const user = await User.findById(subscription.userId).select('+email')
      if (!user || !user.email) return

      const emailData = emailTemplate.paymentFailed({
        name: user.name || 'Valued Customer',
        email: user.email,
        planName: 'Your Plan', // We'll need to get this from subscription
        amount: (invoice.amount_due / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        failureReason: 'Payment method declined',
        retryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        updatePaymentUrl: `${process.env.FRONTEND_URL}/subscription/payment-methods`,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      })

      dispatchEmail(emailData)
      logger.info(`Payment failed email queued for: ${user.email}`)
    } catch (error) {
      logger.error('Error sending payment failed email:', error)
    }
  }

  // Send subscription canceled email
  async sendSubscriptionCanceledEmail(
    subscription: ISubscription,
    plan: ISubscriptionPlan,
    canceledAt: Date
  ): Promise<void> {
    try {
      const user = await User.findById(subscription.userId).select('+email')
      if (!user || !user.email) return

      const emailData = emailTemplate.subscriptionCanceled({
        name: user.name || 'Valued Customer',
        email: user.email,
        planName: plan.name,
        canceledAt,
        accessUntil: subscription.currentPeriodEnd,
        feedbackUrl: `${process.env.FRONTEND_URL}/feedback`,
        reactivateUrl: `${process.env.FRONTEND_URL}/subscription/plans`,
      })

      dispatchEmail(emailData)
      logger.info(`Subscription canceled email queued for: ${user.email}`)
    } catch (error) {
      logger.error('Error sending subscription canceled email:', error)
    }
  }

  // Send plan change notification email
  async sendPlanChangeEmail(
    subscription: ISubscription,
    newPlan: ISubscriptionPlan,
    oldPrice: Stripe.Price
  ): Promise<void> {
    try {
      const user = await User.findById(subscription.userId).select('+email')
      if (!user || !user.email) return

      const isUpgrade = newPlan.price > (oldPrice.unit_amount! / 100)
      const priceDifference = Math.abs(newPlan.price - (oldPrice.unit_amount! / 100))

      const emailData = emailTemplate.planChange({
        name: user.name || 'Valued Customer',
        email: user.email,
        newPlanName: newPlan.name,
        newPlanPrice: newPlan.price,
        planInterval: newPlan.interval,
        isUpgrade,
        priceDifference,
        prorationNote: isUpgrade
          ? `You've been charged $${priceDifference.toFixed(2)} for the remaining billing period.`
          : `You'll receive a $${priceDifference.toFixed(2)} credit on your next invoice.`,
        features: newPlan.features,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
        billingUrl: `${process.env.FRONTEND_URL}/billing`,
      })

      dispatchEmail(emailData)
      logger.info(`Plan change email queued for: ${user.email}`)
    } catch (error) {
      logger.error('Error sending plan change email:', error)
    }
  }

  // Send invoice email (for all charges)
  async sendInvoiceEmail(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.customer_email) {
        logger.warn(`No customer email for invoice: ${invoice.id}`)
        return
      }

      // For now, we'll use the payment success template for invoices
      // You can create a separate invoice template if needed
      const emailData = emailTemplate.paymentSuccess({
        name: 'Valued Customer',
        email: invoice.customer_email,
        invoiceNumber: invoice.number || 'N/A',
        amount: (invoice.amount_due / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        paymentDate: new Date(invoice.created * 1000),
        nextPaymentDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
        invoiceUrl: invoice.hosted_invoice_url || undefined,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      })

      dispatchEmail(emailData)
      logger.info(`Invoice email queued for: ${invoice.customer_email}`)
    } catch (error) {
      logger.error('Error sending invoice email:', error)
    }
  }
}

export const emailNotificationService = new EmailNotificationService()