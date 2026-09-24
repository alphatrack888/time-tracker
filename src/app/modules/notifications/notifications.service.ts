import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { JwtPayload } from 'jsonwebtoken'
import { Types } from 'mongoose'
import { Notification } from './notifications.model'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'



const getNotifications = async (user: JwtPayload, paginationOptions: IPaginationOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(paginationOptions)
  const [result, total, unreadCount] = await Promise.all([
    Notification.find({ to: user.authId })
      .populate('to')
      .populate('from')
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder })
      .lean(),
    Notification.countDocuments({ to: user.authId }),
    // Server-computed, not derived from the current page — the admin/
    // company dashboards' bells (Phase 7/9) approximated this from just
    // the 20 most recent items and explicitly deferred a real count to
    // this phase; mobile's badge (Phase 12) uses this field directly.
    Notification.countDocuments({ to: user.authId, isRead: false }),
  ])

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
      data: result,
    }
}

const readNotification = async (user: JwtPayload, id: string) => {
 try {
    const result = await Notification.findOneAndUpdate(
      { _id: new Types.ObjectId(id), to: user.authId },
      { isRead: true },
      { new: true },
    )
    if (!result) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found')
    }
    return 'Notification read successfully'
 } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to mark notification as read')
 }
}

const readAllNotifications = async (user: JwtPayload) => {
 try {
    await Notification.updateMany({ to: user.authId }, { isRead: true })
    return 'All notifications read successfully'
 } catch {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to mark all notifications as read')
 }
}

export const NotificationServices = {
  getNotifications,
  readNotification,
  readAllNotifications,
}
