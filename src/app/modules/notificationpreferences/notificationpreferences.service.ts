import { JwtPayload } from 'jsonwebtoken';
import { NotificationPreference } from './notificationpreferences.model';
import { DEFAULT_CATEGORIES, DigestMode, ToggleableCategories } from './notificationpreferences.interface';
import { User } from '../user/user.model';
import { Notification } from '../notifications/notifications.model';
import { DEFAULT_LANGUAGE, SupportedLanguage } from '../../../helpers/notificationTemplates';
import { sendNotification } from '../../../helpers/notificationHelper';
import { logger } from '../../../shared/logger';

/**
 * The gating logic notificationHelper.ts consults before creating/sending a
 * notification. A user with no preference document yet — i.e. everyone
 * before this feature shipped, and anyone who's never touched the
 * settings — gets all-enabled, not all-disabled, so this rollout can't
 * silently go dark for existing users.
 */
const getEffectivePreferences = async (
  userId: string,
): Promise<{ pushEnabled: boolean; categories: ToggleableCategories; digestMode: DigestMode }> => {
  const pref = await NotificationPreference.findOne({ user: userId }).lean();
  if (!pref) {
    return { pushEnabled: true, categories: { ...DEFAULT_CATEGORIES }, digestMode: 'realtime' };
  }
  return { pushEnabled: pref.pushEnabled, categories: pref.categories, digestMode: pref.digestMode };
};

const getPreferences = async (user: JwtPayload) => {
  const [effective, userDoc] = await Promise.all([
    getEffectivePreferences(user.authId as string),
    User.findById(user.authId).select('language').lean(),
  ]);
  return {
    ...effective,
    language: (userDoc?.language as SupportedLanguage) || DEFAULT_LANGUAGE,
  };
};

const updatePreferences = async (
  user: JwtPayload,
  payload: {
    pushEnabled?: boolean;
    categories?: Partial<ToggleableCategories>;
    language?: SupportedLanguage;
    digestMode?: DigestMode;
  },
) => {
  const setFields: Record<string, boolean | string> = {};
  if (typeof payload.pushEnabled === 'boolean') {
    setFields.pushEnabled = payload.pushEnabled;
  }
  if (payload.categories) {
    for (const [key, value] of Object.entries(payload.categories)) {
      if (typeof value === 'boolean') {
        setFields[`categories.${key}`] = value;
      }
    }
  }
  if (payload.digestMode) {
    setFields.digestMode = payload.digestMode;
  }

  if (Object.keys(setFields).length > 0) {
    await NotificationPreference.findOneAndUpdate(
      { user: user.authId },
      { $set: setFields, $setOnInsert: { user: user.authId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  if (payload.language) {
    await User.findByIdAndUpdate(user.authId, { $set: { language: payload.language } });
  }

  return getPreferences(user);
};

const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * For every user with digestMode='daily', counts their unread notifications
 * from the last 24 hours and — if there are any — sends one summary
 * notification/push covering all of them. Individual notifications already
 * created their own in-app row when they happened (see notificationHelper's
 * digest check); this is only the batched *push*, sent once.
 *
 * Idempotency is scoped to (user, calendar day of this check — server-UTC,
 * not per-user timezone; see PHASE6_NOTES.md for why that's an accepted
 * simplification here, distinct from the overtime sweep's per-company
 * timezone correctness).
 */
const runNotificationDigestSweep = async (
  now: Date = new Date(),
): Promise<{ usersChecked: number; digestsSent: number }> => {
  const digestUsers = await NotificationPreference.find({ digestMode: 'daily' }).select('user').lean();
  const dateKey = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - DIGEST_WINDOW_MS);
  let digestsSent = 0;

  for (const pref of digestUsers) {
    const userId = pref.user.toString();
    try {
      const count = await Notification.countDocuments({ to: userId, isRead: false, createdAt: { $gte: since } });
      if (count === 0) continue;

      await sendNotification({
        from: userId,
        to: userId,
        kind: 'notificationDigest',
        data: { count },
        idempotencyKey: `digest:${userId}:${dateKey}`,
      });
      digestsSent += 1;
    } catch (err) {
      logger.error(`notification-digest:user-failed userId=${userId}`, err);
    }
  }

  logger.info(`notification-digest:sweep usersChecked=${digestUsers.length} digestsSent=${digestsSent}`);
  return { usersChecked: digestUsers.length, digestsSent };
};

export const NotificationPreferenceServices = {
  getEffectivePreferences,
  getPreferences,
  updatePreferences,
  runNotificationDigestSweep,
};
