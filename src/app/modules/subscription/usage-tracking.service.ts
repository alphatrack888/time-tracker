import { Types } from 'mongoose'
import { logger } from '../../../shared/logger'
import { Subscription } from './subscription.model'
import { User } from '../user/user.model'
import { ISubscriptionPlan } from './subscription.interface'
import ApiError from '../../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'

interface UsageData {
    userId: string
    truckCount: number
    userCount: number
    storageUsed: number
    apiCallsThisMonth: number
}

class UsageTrackingService {
    // Check if user can add more trucks
    async canAddTruck(userId: string): Promise<{ allowed: boolean; reason?: string }> {
        try {
            const subscription = await Subscription.findOne({
                userId: new Types.ObjectId(userId),
                status: { $in: ['active', 'trialing'] },
            }).populate('planId')

            if (!subscription) {
                return { allowed: false, reason: 'No active subscription' }
            }

            // Ensure planId is populated, if not fetch it separately
            let plan: ISubscriptionPlan
            if (
                subscription.planId &&
                typeof subscription.planId === 'object' &&
                'name' in subscription.planId &&
                'maxTrucks' in subscription.planId
            ) {
                plan = subscription.planId as unknown as ISubscriptionPlan
            } else {
                // Fallback: fetch the plan separately if not populated
                const { subscriptionService } = await import('./subscription.service')
                plan = await subscriptionService.getPlanById(subscription.planId.toString())
            }

            // Get current truck count (you'd implement this based on your truck model)
            const currentTruckCount = await this.getCurrentTruckCount(userId)

            if (currentTruckCount >= plan.maxTrucks) {
                return {
                    allowed: false,
                    reason: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxTrucks} trucks.`
                }
            }

            return { allowed: true }
        } catch (error) {
            logger.error('Error checking truck limit:', error)
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to check truck limit')
        }
    }

    // Check if user can add more team members
    async canAddUser(userId: string): Promise<{ allowed: boolean; reason?: string }> {
        try {
            const subscription = await Subscription.findOne({
                userId: new Types.ObjectId(userId),
                status: { $in: ['active', 'trialing'] },
            }).populate('planId')

            if (!subscription) {
                return { allowed: false, reason: 'No active subscription' }
            }

            // Ensure planId is populated, if not fetch it separately
            let plan: ISubscriptionPlan
            if (
                subscription.planId &&
                typeof subscription.planId === 'object' &&
                'name' in subscription.planId &&
                'maxUsers' in subscription.planId
            ) {
                plan = subscription.planId as unknown as ISubscriptionPlan
            } else {
                // Fallback: fetch the plan separately if not populated
                const { subscriptionService } = await import('./subscription.service')
                plan = await subscriptionService.getPlanById(subscription.planId.toString())
            }

            // Get current user count (you'd implement this based on your user model)
            const currentUserCount = await this.getCurrentUserCount(userId)

            if (currentUserCount >= plan.maxUsers) {
                return {
                    allowed: false,
                    reason: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxUsers} users.`
                }
            }

            return { allowed: true }
        } catch (error) {
            logger.error('Error checking user limit:', error)
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to check user limit')
        }
    }

    // Get current usage for a user
    async getCurrentUsage(userId: string): Promise<UsageData> {
        try {
            const truckCount = await this.getCurrentTruckCount(userId)
            const userCount = await this.getCurrentUserCount(userId)

            return {
                userId,
                truckCount,
                userCount,
                storageUsed: 0, // Implement based on your needs
                apiCallsThisMonth: 0, // Implement based on your needs
            }
        } catch (error) {
            logger.error('Error getting current usage:', error)
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get usage data')
        }
    }

    // Get usage with plan limits
    async getUsageWithLimits(userId: string): Promise<{
        usage: UsageData
        limits: {
            maxTrucks: number
            maxUsers: number
        }
        percentages: {
            trucksUsed: number
            usersUsed: number
        }
    }> {
        try {
            const subscription = await Subscription.findOne({
                userId: new Types.ObjectId(userId),
                status: { $in: ['active', 'trialing'] },
            }).populate('planId')

            if (!subscription) {
                throw new ApiError(StatusCodes.NOT_FOUND, 'No active subscription found')
            }

            // Ensure planId is populated, if not fetch it separately
            let plan: ISubscriptionPlan
            if (
                subscription.planId &&
                typeof subscription.planId === 'object' &&
                'name' in subscription.planId &&
                'maxTrucks' in subscription.planId &&
                'maxUsers' in subscription.planId
            ) {
                plan = subscription.planId as unknown as ISubscriptionPlan
            } else {
                // Fallback: fetch the plan separately if not populated
                const { subscriptionService } = await import('./subscription.service')
                plan = await subscriptionService.getPlanById(subscription.planId.toString())
            }

            const usage = await this.getCurrentUsage(userId)

            return {
                usage,
                limits: {
                    maxTrucks: plan.maxTrucks,
                    maxUsers: plan.maxUsers,
                },
                percentages: {
                    trucksUsed: Math.round((usage.truckCount / plan.maxTrucks) * 100),
                    usersUsed: Math.round((usage.userCount / plan.maxUsers) * 100),
                },
            }
        } catch (error) {
            if (error instanceof ApiError) throw error
            logger.error('Error getting usage with limits:', error)
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get usage data')
        }
    }

    // Check if user is approaching limits (80% threshold)
    async checkApproachingLimits(userId: string): Promise<{
        warnings: string[]
        suggestions: string[]
    }> {
        try {
            const data = await this.getUsageWithLimits(userId)
            const warnings: string[] = []
            const suggestions: string[] = []

            if (data.percentages.trucksUsed >= 80) {
                warnings.push(`You're using ${data.percentages.trucksUsed}% of your truck limit`)
                suggestions.push('Consider upgrading your plan to add more trucks')
            }

            if (data.percentages.usersUsed >= 80) {
                warnings.push(`You're using ${data.percentages.usersUsed}% of your user limit`)
                suggestions.push('Consider upgrading your plan to add more team members')
            }

            return { warnings, suggestions }
        } catch (error) {
            logger.error('Error checking approaching limits:', error)
            return { warnings: [], suggestions: [] }
        }
    }

    // Private helper methods (implement based on your data models)
    private async getCurrentTruckCount(userId: string): Promise<number> {
        try {
            // Replace with your actual truck counting logic
            // const count = await Truck.countDocuments({ ownerId: userId, status: 'active' })
            // return count

            // Placeholder implementation
            return 0
        } catch (error) {
            logger.error('Error getting truck count:', error)
            return 0
        }
    }

    private async getCurrentUserCount(userId: string): Promise<number> {
        try {
            // Replace with your actual user counting logic
            // For companies, count team members
            // const count = await User.countDocuments({ companyId: userId, status: 'active' })
            // return count

            // Placeholder implementation
            return 1 // At least the owner
        } catch (error) {
            logger.error('Error getting user count:', error)
            return 1
        }
    }

    // Track feature usage (for analytics)
    async trackFeatureUsage(userId: string, feature: string): Promise<void> {
        try {
            // Implement feature usage tracking
            logger.info(`Feature used: ${feature} by user: ${userId}`)

            // You could store this in a separate collection for analytics
            // await FeatureUsage.create({ userId, feature, timestamp: new Date() })
        } catch (error) {
            logger.error('Error tracking feature usage:', error)
        }
    }
}

export const usageTrackingService = new UsageTrackingService()