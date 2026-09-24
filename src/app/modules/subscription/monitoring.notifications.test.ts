import { Types } from 'mongoose'
import { monitoringService } from './monitoring.service'
import { Subscription } from './subscription.model'
import { Notification } from '../notifications/notifications.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import config from '../../../config'

describe('Subscription monitoring notifications (Phase 3: connects the previously-commented-out TODOs)', () => {
  const seedSystemUser = () =>
    User.create({
      name: 'SUPER_ADMIN',
      email: config.super_admin.email,
      password: 'Password123!',
      role: USER_ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  const baseSubscriptionFields = () => ({
    planId: new Types.ObjectId(),
    price: 29,
    stripeCustomerId: `cus_${Date.now()}`,
    stripeSubscriptionId: `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    stripePriceId: 'price_test',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  describe('monitorPaymentFailures', () => {
    it('notifies the company admin for a subscription with repeated payment failures', async () => {
      await seedSystemUser()
      const companyAdmin = await User.create({
        name: 'Failing Co',
        email: 'failing-co@example.com',
        password: 'Password123!',
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
      })
      const subscription = await Subscription.create({
        ...baseSubscriptionFields(),
        userId: companyAdmin._id,
        status: 'past_due',
        paymentFailureCount: 3,
      })

      await monitoringService.monitorPaymentFailures()

      const notification = await Notification.findOne({
        to: companyAdmin._id,
        idempotencyKey: `subscription:${subscription._id.toString()}:paymentFailure:3`,
      })
      expect(notification).not.toBeNull()
      expect(notification?.title).toBe('Payment issue with your subscription')
    })

    it('does not re-notify on a second sweep while the failure count is unchanged', async () => {
      await seedSystemUser()
      const companyAdmin = await User.create({
        name: 'Failing Co 2',
        email: 'failing-co-2@example.com',
        password: 'Password123!',
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
      })
      await Subscription.create({
        ...baseSubscriptionFields(),
        userId: companyAdmin._id,
        status: 'past_due',
        paymentFailureCount: 4,
      })

      await monitoringService.monitorPaymentFailures()
      await monitoringService.monitorPaymentFailures()

      const count = await Notification.countDocuments({ to: companyAdmin._id })
      expect(count).toBe(1)
    })

    it('does not notify for a subscription with fewer than 3 failures', async () => {
      await seedSystemUser()
      const companyAdmin = await User.create({
        name: 'Healthy Co',
        email: 'healthy-co@example.com',
        password: 'Password123!',
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
      })
      await Subscription.create({
        ...baseSubscriptionFields(),
        userId: companyAdmin._id,
        status: 'past_due',
        paymentFailureCount: 1,
      })

      await monitoringService.monitorPaymentFailures()

      expect(await Notification.countDocuments({ to: companyAdmin._id })).toBe(0)
    })
  })

  describe('monitorTrialConversions', () => {
    it('notifies the company admin when their trial ends within 3 days', async () => {
      await seedSystemUser()
      const companyAdmin = await User.create({
        name: 'Trialing Co',
        email: 'trialing-co@example.com',
        password: 'Password123!',
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
      })
      const trialEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      const subscription = await Subscription.create({
        ...baseSubscriptionFields(),
        userId: companyAdmin._id,
        status: 'trialing',
        trialEnd,
      })

      await monitoringService.monitorTrialConversions()

      const trialEndDate = trialEnd.toISOString().slice(0, 10)
      const notification = await Notification.findOne({
        to: companyAdmin._id,
        idempotencyKey: `subscription:${subscription._id.toString()}:trialEndingReminder:${trialEndDate}`,
      })
      expect(notification).not.toBeNull()
      expect(notification?.title).toBe('Your trial is ending soon')
    })

    it('does not re-notify on a later sweep within the same 3-day window', async () => {
      await seedSystemUser()
      const companyAdmin = await User.create({
        name: 'Trialing Co 2',
        email: 'trialing-co-2@example.com',
        password: 'Password123!',
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
      })
      await Subscription.create({
        ...baseSubscriptionFields(),
        userId: companyAdmin._id,
        status: 'trialing',
        trialEnd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      })

      await monitoringService.monitorTrialConversions()
      await monitoringService.monitorTrialConversions()

      expect(await Notification.countDocuments({ to: companyAdmin._id })).toBe(1)
    })

    it('does not notify for a trial ending more than 3 days out', async () => {
      await seedSystemUser()
      const companyAdmin = await User.create({
        name: 'Early Trial Co',
        email: 'early-trial-co@example.com',
        password: 'Password123!',
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
      })
      await Subscription.create({
        ...baseSubscriptionFields(),
        userId: companyAdmin._id,
        status: 'trialing',
        trialEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      })

      await monitoringService.monitorTrialConversions()

      expect(await Notification.countDocuments({ to: companyAdmin._id })).toBe(0)
    })
  })
})
