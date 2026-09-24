import express from 'express'
import auth from '../../middleware/auth'
import rateLimitMiddleware from '../../middleware/rateLimitter'
import { USER_ROLES } from '../../../enum/user'
import { NotificationController } from './notifications.controller'

const router = express.Router()

// Was EMPLOYEES/ADMIN only, which silently 403'd COMPANY and SUPER_ADMIN out
// of every notification endpoint — undetected until Phase 12, because every
// earlier phase that built a notification UI for those two roles (Phase 7's
// admin dashboard, Phase 9's company dashboard) had no reachable real
// backend to test against and only ever verified with mocked responses.
// Every notification recipient role needs these — matches the pattern
// already used for notification-preferences and the reportjob module.
const anyAuthenticatedRole = [
  USER_ROLES.EMPLOYEES,
  USER_ROLES.COMPANY,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN,
]

// Phase 14 audit: the web bells (Phase 7/9) poll every 45s and mobile
// fetches on every screen mount/resume — 60/minute per IP comfortably
// covers normal usage (even several users behind one NAT/IP) while still
// bounding a buggy client stuck in a tight poll loop.
router.get(
  '/',
  rateLimitMiddleware(60, 60_000),
  auth(...anyAuthenticatedRole),
  NotificationController.getMyNotifications,
)
router.patch('/all', auth(...anyAuthenticatedRole), NotificationController.updateAllNotifications)
router.patch('/:id', auth(...anyAuthenticatedRole), NotificationController.updateNotification)
export const NotificationRoutes = router
