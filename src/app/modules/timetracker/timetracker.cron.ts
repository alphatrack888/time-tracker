import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../../../shared/logger';
import { runForgotClockOutSweep, runDailyOvertimeSweep } from './timetracker.triggers';
import { NotificationPreferenceServices } from '../notificationpreferences/notificationpreferences.service';

/**
 * Scheduled jobs for the checker functions built in Phase 3 but left
 * unwired, plus the Phase 6 notification digest. Kept as its own registry
 * (structurally similar to, but independent from,
 * subscription/cron.service.ts) rather than folding into that
 * subscription-specific class — the two have different gating concerns
 * (subscription monitoring only matters where Stripe billing exists;
 * these matter for every deployment) and merging them risked destabilizing
 * already-verified Phase 0 code for a modest amount of shared boilerplate.
 */
class TimeTrackerCronService {
    private jobs: Map<string, ScheduledTask> = new Map()
    private jobStatus: Map<string, boolean> = new Map()

    // Started unconditionally unless explicitly disabled — unlike the
    // subscription jobs, these aren't billing-specific, so there's no
    // "irrelevant outside production" case to gate on. ENABLE_TIMETRACKER_CRON
    // is available as an escape hatch if a deployment needs to turn them off.
    startTimeTrackerCronJobs(): void {
        if (process.env.ENABLE_TIMETRACKER_CRON === 'false') {
            logger.info('Time tracker cron jobs disabled via ENABLE_TIMETRACKER_CRON=false')
            return
        }

        this.startForgotClockOutSweep()
        this.startDailyOvertimeSweep()
        this.startNotificationDigest()

        logger.info('Time tracker cron jobs started')
    }

    // Reminds employees who forgot to clock out — checked hourly (see
    // timetracker.triggers.ts: idempotency caps this at one reminder per
    // calendar day regardless of how often the sweep runs).
    private startForgotClockOutSweep(): void {
        const job = cron.createTask('0 * * * *', async () => {
            try {
                logger.info('Running forgot-clock-out sweep...')
                const result = await runForgotClockOutSweep()
                logger.info(`Forgot-clock-out sweep complete: checked=${result.checked} notified=${result.notified}`)
            } catch (error) {
                logger.error('Error in forgot-clock-out sweep cron:', error)
            }
        }, {
            timezone: 'UTC'
        })

        job.start()
        this.jobs.set('forgot-clock-out-sweep', job)
        this.jobStatus.set('forgot-clock-out-sweep', true)
        logger.info('Forgot-clock-out sweep cron job scheduled (every hour)')
    }

    // Checks every company's most recently completed *local* day for
    // overtime — every 4 hours so each company's day gets checked
    // reasonably soon after their local midnight regardless of timezone,
    // without a per-company schedule. Safe to re-run: idempotency is keyed
    // per (employee, local date).
    private startDailyOvertimeSweep(): void {
        const job = cron.createTask('0 */4 * * *', async () => {
            try {
                logger.info('Running daily overtime sweep...')
                const result = await runDailyOvertimeSweep()
                logger.info(`Daily overtime sweep complete: companiesChecked=${result.companiesChecked} notified=${result.notified}`)
            } catch (error) {
                logger.error('Error in daily overtime sweep cron:', error)
            }
        }, {
            timezone: 'UTC'
        })

        job.start()
        this.jobs.set('daily-overtime-sweep', job)
        this.jobStatus.set('daily-overtime-sweep', true)
        logger.info('Daily overtime sweep cron job scheduled (every 4 hours)')
    }

    // Sends the batched daily push to users with digestMode='daily'. Fixed
    // UTC send time (default 07:00, configurable via DIGEST_SEND_TIME) —
    // not personalized per-user timezone. That's a deliberate, smaller-scope
    // simplification than the overtime sweep's per-company timezone
    // correctness: sending a digest at a "wrong" local hour is a UX
    // nicety gap, not a correctness bug the way evaluating the wrong day's
    // hours would be (see PHASE6_NOTES.md).
    private startNotificationDigest(): void {
        const sendTime = process.env.DIGEST_SEND_TIME || '07:00'
        const [hour, minute] = sendTime.split(':')

        const job = cron.createTask(`${minute} ${hour} * * *`, async () => {
            try {
                logger.info('Running notification digest sweep...')
                const result = await NotificationPreferenceServices.runNotificationDigestSweep()
                logger.info(`Notification digest sweep complete: usersChecked=${result.usersChecked} digestsSent=${result.digestsSent}`)
            } catch (error) {
                logger.error('Error in notification digest sweep cron:', error)
            }
        }, {
            timezone: 'UTC'
        })

        job.start()
        this.jobs.set('notification-digest', job)
        this.jobStatus.set('notification-digest', true)
        logger.info(`Notification digest cron job scheduled (${sendTime} UTC)`)
    }

    stopAllJobs(): void {
        this.jobs.forEach((job, name) => {
            job.stop()
            this.jobStatus.set(name, false)
            logger.info(`Stopped cron job: ${name}`)
        })

        this.jobs.clear()
        this.jobStatus.clear()
        logger.info('All time tracker cron jobs stopped')
    }

    getJobsStatus(): { [key: string]: boolean } {
        const status: { [key: string]: boolean } = {}

        this.jobStatus.forEach((isRunning, name) => {
            status[name] = isRunning
        })

        return status
    }

    stopJob(jobName: string): boolean {
        const job = this.jobs.get(jobName)
        if (job) {
            job.stop()
            this.jobStatus.set(jobName, false)
            logger.info(`Stopped cron job: ${jobName}`)
            return true
        }
        return false
    }

    startJob(jobName: string): boolean {
        const job = this.jobs.get(jobName)
        if (job) {
            job.start()
            this.jobStatus.set(jobName, true)
            logger.info(`Started cron job: ${jobName}`)
            return true
        }
        return false
    }
}

export const timeTrackerCronService = new TimeTrackerCronService()
