import cron from 'node-cron'
import { logger } from '../../../shared/logger'
import { monitoringService } from './monitoring.service'

class CronService {
    private jobs: Map<string, cron.ScheduledTask> = new Map()
    private jobStatus: Map<string, boolean> = new Map()

    // Start all subscription-related cron jobs
    startSubscriptionCronJobs(): void {
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SUBSCRIPTION_MONITORING === 'true') {
            this.startHealthMonitoring()
            this.startDailyReporting()
            this.startWebhookHealthCheck()
            this.startTrialConversionMonitoring()

            logger.info('Subscription cron jobs started')
        } else {
            logger.info('Subscription monitoring disabled in development mode')
        }
    }

    // Monitor subscription health every hour
    private startHealthMonitoring(): void {
        const job = cron.schedule('0 * * * *', async () => {
            try {
                logger.info('Running subscription health monitoring...')
                await monitoringService.runAllMonitoringTasks()
            } catch (error) {
                logger.error('Error in subscription health monitoring cron:', error)
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        })

        job.start()
        this.jobs.set('health-monitoring', job)
        this.jobStatus.set('health-monitoring', true)
        logger.info('Health monitoring cron job scheduled (every hour)')
    }

    // Generate daily reports at 9 AM UTC
    private startDailyReporting(): void {
        const reportTime = process.env.DAILY_REPORT_TIME || '09:00'
        const [hour, minute] = reportTime.split(':')

        const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
            try {
                logger.info('Generating daily subscription report...')
                const report = await monitoringService.generateDailyReport()

                // You could send this report via email or Slack
                logger.info('Daily subscription report generated successfully')
            } catch (error) {
                logger.error('Error generating daily subscription report:', error)
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        })

        job.start()
        this.jobs.set('daily-reporting', job)
        this.jobStatus.set('daily-reporting', true)
        logger.info(`Daily reporting cron job scheduled (${reportTime} UTC)`)
    }

    // Check webhook health every 6 hours
    private startWebhookHealthCheck(): void {
        const job = cron.schedule('0 */6 * * *', async () => {
            try {
                logger.info('Running webhook health check...')
                await monitoringService.monitorWebhookHealth()
            } catch (error) {
                logger.error('Error in webhook health check cron:', error)
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        })

        job.start()
        this.jobs.set('webhook-health', job)
        this.jobStatus.set('webhook-health', true)
        logger.info('Webhook health check cron job scheduled (every 6 hours)')
    }

    // Monitor trial conversions every 4 hours
    private startTrialConversionMonitoring(): void {
        const job = cron.schedule('0 */4 * * *', async () => {
            try {
                logger.info('Running trial conversion monitoring...')
                await monitoringService.monitorTrialConversions()
            } catch (error) {
                logger.error('Error in trial conversion monitoring cron:', error)
            }
        }, {
            scheduled: false,
            timezone: 'UTC'
        })

        job.start()
        this.jobs.set('trial-conversion', job)
        this.jobStatus.set('trial-conversion', true)
        logger.info('Trial conversion monitoring cron job scheduled (every 4 hours)')
    }

    // Stop all cron jobs
    stopAllJobs(): void {
        this.jobs.forEach((job, name) => {
            job.stop()
            this.jobStatus.set(name, false)
            logger.info(`Stopped cron job: ${name}`)
        })

        this.jobs.clear()
        this.jobStatus.clear()
        logger.info('All subscription cron jobs stopped')
    }

    // Get status of all jobs
    getJobsStatus(): { [key: string]: boolean } {
        const status: { [key: string]: boolean } = {}

        this.jobStatus.forEach((isRunning, name) => {
            status[name] = isRunning
        })

        return status
    }

    // Stop a specific job
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

    // Start a specific job (if it was stopped)
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

export const cronService = new CronService()