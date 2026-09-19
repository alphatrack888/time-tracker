
import { UserRoutes } from '../app/modules/user/user.route'
import { AuthRoutes } from '../app/modules/auth/auth.route'
import express, { Router } from 'express'
import { NotificationRoutes } from '../app/modules/notifications/notifications.route'
import { PublicRoutes } from '../app/modules/public/public.route'
import { PackageRoutes } from '../app/modules/package/package.route'
import { PayroleRoutes } from '../app/modules/payrole/payrole.route'
import { ProjectRoutes } from '../app/modules/project/project.route'
import { NoteRoutes } from '../app/modules/note/note.route'
import { LeavebalanceRoutes } from '../app/modules/leavebalance/leavebalance.route'
import { LeavemanagementRoutes } from '../app/modules/leavemanagement/leavemanagement.route'
import { TimeTrackerRoutes } from '../app/modules/timetracker/timetracker.route'
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route'
import { dashboardRoutes } from '../app/modules/dashboard/dashboard.route'
import { GalleryRoutes } from '../app/modules/gallery/gallery.route'
import { TruckRoutes } from '../app/modules/truck/truck.route'




const router = express.Router()

const apiRoutes: { path: string; route: Router }[] = [
  { path: '/user', route: UserRoutes },
  { path: '/auth', route: AuthRoutes },
  { path: '/notifications', route: NotificationRoutes },
  { path: '/public', route: PublicRoutes },
  { path: '/package', route: PackageRoutes },
  { path: '/payrole', route: PayroleRoutes },
  { path: '/project', route: ProjectRoutes },
  { path: '/note', route: NoteRoutes },
  { path: '/leavebalance', route: LeavebalanceRoutes },
  { path: '/leavemanagement', route: LeavemanagementRoutes },
  { path: '/subscriptions', route: SubscriptionRoutes },
  { path: '/timetracker', route: TimeTrackerRoutes }, 
  { path: '/dashboard', route: dashboardRoutes },
  { path: '/gallery', route: GalleryRoutes },
  { path: '/truck', route: TruckRoutes }]

apiRoutes.forEach(route => {
  router.use(route.path, route.route)
})

export default router
