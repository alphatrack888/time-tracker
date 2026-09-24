import { timeTrackerCronService } from './timetracker.cron'

describe('timeTrackerCronService.startTimeTrackerCronJobs (Phase 6: wires Phase 3\'s built-but-unscheduled sweeps)', () => {
  afterEach(() => {
    // Cron jobs schedule real timers; never let one leak past its test.
    timeTrackerCronService.stopAllJobs()
  })

  it('starts all three jobs by default (unlike subscription monitoring, these are not production-only)', () => {
    const prevFlag = process.env.ENABLE_TIMETRACKER_CRON
    delete process.env.ENABLE_TIMETRACKER_CRON

    timeTrackerCronService.startTimeTrackerCronJobs()

    expect(timeTrackerCronService.getJobsStatus()).toEqual({
      'forgot-clock-out-sweep': true,
      'daily-overtime-sweep': true,
      'notification-digest': true,
    })

    process.env.ENABLE_TIMETRACKER_CRON = prevFlag
  })

  it('starts nothing when explicitly disabled via ENABLE_TIMETRACKER_CRON=false', () => {
    const prevFlag = process.env.ENABLE_TIMETRACKER_CRON
    process.env.ENABLE_TIMETRACKER_CRON = 'false'

    timeTrackerCronService.startTimeTrackerCronJobs()

    expect(timeTrackerCronService.getJobsStatus()).toEqual({})

    process.env.ENABLE_TIMETRACKER_CRON = prevFlag
  })

  it('stopAllJobs stops every running job', () => {
    timeTrackerCronService.startTimeTrackerCronJobs()
    expect(Object.values(timeTrackerCronService.getJobsStatus())).toContain(true)

    timeTrackerCronService.stopAllJobs()

    expect(timeTrackerCronService.getJobsStatus()).toEqual({})
  })

  it('individual jobs can be stopped and restarted by name', () => {
    timeTrackerCronService.startTimeTrackerCronJobs()

    expect(timeTrackerCronService.stopJob('daily-overtime-sweep')).toBe(true)
    expect(timeTrackerCronService.getJobsStatus()['daily-overtime-sweep']).toBe(false)

    expect(timeTrackerCronService.startJob('daily-overtime-sweep')).toBe(true)
    expect(timeTrackerCronService.getJobsStatus()['daily-overtime-sweep']).toBe(true)
  })

  it('stopJob/startJob return false for an unknown job name', () => {
    expect(timeTrackerCronService.stopJob('does-not-exist')).toBe(false)
    expect(timeTrackerCronService.startJob('does-not-exist')).toBe(false)
  })
})
