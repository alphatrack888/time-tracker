import { logger } from '../../../shared/logger'
import { Subscription } from './subscription.model'
import { SubscriptionPlan } from './subscription-plan.model'
import { stripeService } from './stripe.service'
import Stripe from 'stripe'

class MonitoringService {
    // Monitor subscription health
    async monitorSubscriptionHealth(): Promise<void> {
        try {
            // Check for subscriptions that should have ended but are still active
            const expiredSubscriptions = await Subscription.find({
                status: { $in: ['active', 'trialing'] },
                currentPeriodEnd: { $lt: new Date() },
            })

            if (expiredSubscriptions.length > 0) {
                logger.warn(`Found ${expiredSubscriptions.length} expired but active subscriptions`)

                // Sync with Stripe to get current status
                for (const subscription of expiredSubscriptions) {
                    try {
                        const stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId)
                        const stripeSubscriptionLineItems = stripeSubscription.items.data.find((item) => item.object === 'subscription_item') as Stripe.SubscriptionItem
                        if (stripeSubscription.status !== subscription.status) {
                            await Subscription.findByIdAndUpdate(subscription._id, {
                                status: stripeSubscription.status,
                                price: stripeSubscriptionLineItems.price.unit_amount ? stripeSubscriptionLineItems.price.unit_amount / 100 : 0,
                                currentPeriodStart: new Date(stripeSubscriptionLineItems.current_period_start * 1000),
                                currentPeriodEnd: new Date(stripeSubscriptionLineItems.current_period_end * 1000),
                            })

                            logger.info(`Synced subscription status: ${subscription._id}`)
                        }
                    } catch (error) {
                        logger.error(`Error syncing subscription ${subscription._id}:`, error)
                    }
                }
            }
        } catch (error) {
            logger.error('Error monitoring subscription health:', error)
        }
    }

    // Monitor payment failures
    async monitorPaymentFailures(): Promise<void> {
        try {
            const failedPayments = await Subscription.find({
                paymentFailureCount: { $gte: 3 },
                status: 'past_due',
                updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
            }).populate(['userId', 'planId'])

            if (failedPayments.length > 0) {
                logger.warn(`HIGH PRIORITY: ${failedPayments.length} subscriptions with multiple payment failures`)

                // Send alerts to admin
                for (const subscription of failedPayments) {
                    logger.error(`PAYMENT FAILURE ALERT: Subscription ${subscription._id} has ${subscription.paymentFailureCount} failed attempts`)

                    // You could integrate with your notification service here
                    // await notificationService.sendPaymentFailureAlert(subscription)
                }
            }
        } catch (error) {
            logger.error('Error monitoring payment failures:', error)
        }
    }

    // Monitor trial conversions
    async monitorTrialConversions(): Promise<void> {
        try {
            const trialEndingSoon = await Subscription.find({
                status: 'trialing',
                trialEnd: {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Next 3 days
                },
            }).populate(['userId', 'planId'])

            if (trialEndingSoon.length > 0) {
                logger.info(`${trialEndingSoon.length} trials ending in the next 3 days`)

                // Send conversion reminders
                for (const subscription of trialEndingSoon) {
                    logger.info(`Trial ending soon: ${subscription._id}`)

                    // You could send reminder emails here
                    // await emailService.sendTrialEndingReminder(subscription)
                }
            }
        } catch (error) {
            logger.error('Error monitoring trial conversions:', error)
        }
    }

    // Monitor plan usage and limits
    async monitorPlanUsage(): Promise<void> {
        try {
            // This would depend on your specific usage tracking implementation
            // Example: Check if users are approaching their plan limits

            const activeSubscriptions = await Subscription.find({
                status: { $in: ['active', 'trialing'] },
            }).populate(['userId', 'planId'])

            for (const _subscription of activeSubscriptions) {
                // Example usage monitoring logic
                // const usage = await getUserUsage(subscription.userId)
                // const plan = subscription.planId as ISubscriptionPlan

                // if (usage.truckCount >= plan.maxTrucks * 0.8) {
                //   logger.warn(`User ${subscription.userId} approaching truck limit`)
                //   // Send upgrade suggestion
                // }
            }
        } catch (error) {
            logger.error('Error monitoring plan usage:', error)
        }
    }

    // Generate daily health report
    async generateDailyReport(): Promise<any> {
        try {
            const today = new Date()
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

            const report: any = {
                date: today.toISOString().split('T')[0],
                subscriptions: {
                    total: await Subscription.countDocuments(),
                    active: await Subscription.countDocuments({ status: 'active' }),
                    trialing: await Subscription.countDocuments({ status: 'trialing' }),
                    pastDue: await Subscription.countDocuments({ status: 'past_due' }),
                    canceled: await Subscription.countDocuments({ status: 'canceled' }),
                },
                newSubscriptions: await Subscription.countDocuments({
                    createdAt: { $gte: yesterday, $lt: today },
                }),
                canceledSubscriptions: await Subscription.countDocuments({
                    status: 'canceled',
                    updatedAt: { $gte: yesterday, $lt: today },
                }),
                paymentFailures: await Subscription.countDocuments({
                    paymentFailureCount: { $gt: 0 },
                    updatedAt: { $gte: yesterday, $lt: today },
                }),
                plans: {
                    total: await SubscriptionPlan.countDocuments(),
                    active: await SubscriptionPlan.countDocuments({ isActive: true }),
                },
            }

            // Calculate churn rate
            const totalActive = report.subscriptions.active + report.subscriptions.trialing
            report.churnRate = totalActive > 0
                ? ((report.canceledSubscriptions / totalActive) * 100).toFixed(2)
                : '0.00'

            logger.info('Daily subscription report generated', report)
            return report
        } catch (error) {
            logger.error('Error generating daily report:', error)
            throw error
        }
    }

    // Check for webhook processing delays
    async monitorWebhookHealth(): Promise<void> {
        try {
            // Check for subscriptions that haven't been updated by webhooks recently
            const staleSubscriptions = await Subscription.find({
                status: { $in: ['active', 'trialing'] },
                updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days old
            })

            if (staleSubscriptions.length > 0) {
                logger.warn(`Found ${staleSubscriptions.length} subscriptions with stale webhook data`)

                // Sync with Stripe
                for (const subscription of staleSubscriptions.slice(0, 10)) { // Limit to 10 to avoid rate limits
                    try {
                        const stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId)

                        await Subscription.findByIdAndUpdate(subscription._id, {
                            status: stripeSubscription.status,
                            price: stripeSubscription.items.data[0].price.unit_amount ? stripeSubscription.items.data[0].price.unit_amount / 100 : 0,
                            currentPeriodStart: new Date(stripeSubscription.items.data[0].current_period_start * 1000),
                            currentPeriodEnd: new Date(stripeSubscription.items.data[0].current_period_end * 1000),
                            updatedAt: new Date(),
                        })

                        logger.info(`Synced stale subscription: ${subscription._id}`)
                    } catch (error) {
                        logger.error(`Error syncing stale subscription ${subscription._id}:`, error)
                    }
                }
            }
        } catch (error) {
            logger.error('Error monitoring webhook health:', error)
        }
    }

    // Run all monitoring tasks
    async runAllMonitoringTasks(): Promise<void> {
        logger.info('Starting subscription monitoring tasks...')

        await Promise.allSettled([
            this.monitorSubscriptionHealth(),
            this.monitorPaymentFailures(),
            this.monitorTrialConversions(),
            this.monitorPlanUsage(),
            this.monitorWebhookHealth(),
        ])

        logger.info('Subscription monitoring tasks completed')
    }
}

export const monitoringService = new MonitoringService()