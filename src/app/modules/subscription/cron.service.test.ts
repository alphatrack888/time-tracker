import { cronService } from './cron.service'

describe('cronService.startSubscriptionCronJobs (Phase 0 fix: jobs were defined but never started)', () => {
  afterEach(() => {
    // Cron jobs schedule real timers; never let one leak past its test.
    cronService.stopAllJobs()
  })

  it('starts all four subscription jobs when monitoring is enabled', () => {
    const prevEnv = process.env.ENABLE_SUBSCRIPTION_MONITORING
    process.env.ENABLE_SUBSCRIPTION_MONITORING = 'true'

    cronService.startSubscriptionCronJobs()

    const status = cronService.getJobsStatus()
    expect(status).toEqual({
      'health-monitoring': true,
      'daily-reporting': true,
      'webhook-health': true,
      'trial-conversion': true,
    })

    process.env.ENABLE_SUBSCRIPTION_MONITORING = prevEnv
  })

  it('does not start any job when monitoring is disabled (dev default)', () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevEnableFlag = process.env.ENABLE_SUBSCRIPTION_MONITORING
    process.env.NODE_ENV = 'development'
    process.env.ENABLE_SUBSCRIPTION_MONITORING = 'false'

    cronService.startSubscriptionCronJobs()

    expect(cronService.getJobsStatus()).toEqual({})

    process.env.NODE_ENV = prevNodeEnv
    process.env.ENABLE_SUBSCRIPTION_MONITORING = prevEnableFlag
  })

  it('stopAllJobs stops every running job', () => {
    process.env.ENABLE_SUBSCRIPTION_MONITORING = 'true'
    cronService.startSubscriptionCronJobs()
    expect(Object.values(cronService.getJobsStatus())).toContain(true)

    cronService.stopAllJobs()

    expect(cronService.getJobsStatus()).toEqual({})
  })
})
