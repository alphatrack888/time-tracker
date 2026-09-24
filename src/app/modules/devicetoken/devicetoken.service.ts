import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { logger } from '../../../shared/logger';
import { DeviceToken } from './devicetoken.model';
import { DeviceTokenPlatform } from './devicetoken.interface';

/**
 * Upserts a push token for the given user. A token is unique across the
 * whole collection (see the model's unique index), so if the same token
 * was previously registered to a different user — e.g. a shared/kiosk
 * device that just changed hands — this call reassigns it to the new
 * owner rather than creating a duplicate row, and logs the reassignment
 * so it's visible in support/debugging without being treated as an error.
 */
const registerDeviceToken = async (
  user: JwtPayload,
  payload: { token: string; platform?: DeviceTokenPlatform; appVersion?: string },
) => {
  const userId = user.authId as string;
  const existing = await DeviceToken.findOne({ token: payload.token });

  if (existing && existing.user.toString() !== userId) {
    logger.info(
      `Device token reassigned from user ${existing.user.toString()} to user ${userId}`,
    );
  }

  const result = await DeviceToken.findOneAndUpdate(
    { token: payload.token },
    {
      $set: {
        user: new Types.ObjectId(userId),
        platform: payload.platform || 'unknown',
        appVersion: payload.appVersion,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return result;
};

/**
 * Deregisters a token, scoped to the requesting user — a user may only ever
 * remove their own device, never one belonging to someone else (called on
 * logout, and defensively before re-registering a fresh token).
 */
const deregisterDeviceToken = async (user: JwtPayload, token: string) => {
  const result = await DeviceToken.findOneAndDelete({ token, user: user.authId });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Device token not found for this user');
  }
  return result;
};

const listMyDevices = async (user: JwtPayload) => {
  return DeviceToken.find({ user: user.authId }).sort({ lastSeenAt: -1 }).lean();
};

/**
 * Data-access helper for the push-sending path (fully wired up in Phase 2):
 * returns every active token string for a user, so a single notification
 * event can fan out to all of that user's registered devices.
 */
const getTokensForUser = async (userId: string | Types.ObjectId): Promise<string[]> => {
  const tokens = await DeviceToken.find({ user: userId }).select('token').lean();
  return tokens.map((t) => t.token);
};

/**
 * Removes a token FCM has reported as invalid/expired (used by Phase 2's
 * send-result handling) so it's never retried again.
 */
const removeStaleToken = async (token: string) => {
  await DeviceToken.deleteOne({ token });
};

export const DeviceTokenServices = {
  registerDeviceToken,
  deregisterDeviceToken,
  listMyDevices,
  getTokensForUser,
  removeStaleToken,
};
