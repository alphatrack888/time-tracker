import { Notification } from '../app/modules/notifications/notifications.model'
import { User } from '../app/modules/user/user.model'
import { logger } from '../shared/logger'
import { sendPushNotification } from './pushnotificationHelper'
import { emitEvent } from './socketInstances'
import { DeviceTokenServices } from '../app/modules/devicetoken/devicetoken.service'
import { NotificationPreferenceServices } from '../app/modules/notificationpreferences/notificationpreferences.service'
import {
  KIND_CATEGORY,
  MANDATORY_CATEGORIES,
  NotificationCategory,
  NotificationKind,
  renderNotificationTemplate,
} from './notificationTemplates'

type BasePayload = {
  from: string
  to: string
  /**
   * Idempotency key derived from the triggering business entity (e.g.
   * `leaveRequest:<id>:submitted`). When given, a second call with the same
   * key is a safe no-op — enforced by a unique+sparse index on
   * Notification.idempotencyKey, so this is race-safe under concurrent
   * calls (a duplicate-key error on create), not just a check-then-create.
   * Omit for ad-hoc sends that have no natural dedupe key.
   */
  idempotencyKey?: string
}

type TemplatedPayload = BasePayload & {
  /** Selects both the localized copy (via notificationTemplates.ts) and the preference category — callers can't tag a notification with a category that doesn't match its own content. */
  kind: NotificationKind
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>
  title?: never
  body?: never
  category?: never
}

type LiteralPayload = BasePayload & {
  kind?: never
  data?: never
  title: string
  body: string
  /**
   * Preference category to gate this send on. Omitted entirely, a literal
   * title/body send is never gated by preferences at all (treated like a
   * mandatory/'account' send) — used for ad-hoc sends outside the template
   * catalogue. Every real trigger in this codebase uses `kind` instead.
   */
  category?: NotificationCategory
}

export type SendNotificationPayload = TemplatedPayload | LiteralPayload

const resolveContent = async (payload: SendNotificationPayload): Promise<{ title: string; body: string; category?: NotificationCategory }> => {
  if (payload.kind) {
    const category = KIND_CATEGORY[payload.kind]
    const recipient = await User.findById(payload.to).select('language').lean()
    const { title, body } = renderNotificationTemplate(payload.kind, recipient?.language, payload.data)
    return { title, body, category }
  }
  return { title: payload.title, body: payload.body, category: payload.category }
}

/**
 * Fans a single notification event out to: (1) a persisted, readable
 * Notification row, (2) a real-time in-app event over Socket.IO, and
 * (3) an OS-level push to every device the recipient has registered.
 *
 * Each of those three steps is independently best-effort: a failure in one
 * must never prevent the others, and none of them may ever propagate back
 * to the caller — the business operation that triggered this (approving a
 * leave request, adding an employee to a project, ...) must always succeed
 * regardless of what happens here.
 *
 * Before any of that, checks the recipient's notification preferences
 * (Phase 4): a category the recipient has turned off is skipped entirely —
 * no DB row, no socket emit, no push — unless the category is mandatory
 * (currently only 'account'). A user with no preference record yet (i.e.
 * everyone before this feature shipped) is treated as all-enabled.
 */
export const sendNotification = async (payload: SendNotificationPayload) => {
  const { from, to, idempotencyKey } = payload
  const { title, body, category } = await resolveContent(payload)

  // Fetched once up front (not re-fetched before the push step below) —
  // one preference lookup covers both the category gate and the pushEnabled
  // gate for this send.
  const preferences = category ? await NotificationPreferenceServices.getEffectivePreferences(to) : null

  if (
    category &&
    preferences &&
    !MANDATORY_CATEGORIES.has(category) &&
    !preferences.categories[category as keyof typeof preferences.categories]
  ) {
    logger.info(`notification:skipped reason=category-disabled category=${category} to=${to}`)
    return
  }

  let created
  try {
    created = await Notification.create({
      from,
      to,
      title,
      body,
      isRead: false,
      ...(category && { category }),
      ...(idempotencyKey && { idempotencyKey }),
    })
  } catch (err: unknown) {
    const errorCode = (err as { code?: number } | undefined)?.code
    if (idempotencyKey && errorCode === 11000) {
      logger.info(`notification:skipped reason=duplicate-idempotency-key key=${idempotencyKey}`)
      return
    }
    logger.error(`notification:create-failed to=${to} title="${title}"`, err)
    return
  }

  try {
    const populatedResult = await Notification.findById(created._id)
      .populate('from', { profile: 1, name: 1 })
      .populate('to', { profile: 1, name: 1 })
      .lean()

    emitEvent(`notification::${to.toString()}`, populatedResult)
  } catch (err) {
    logger.error(`notification:socket-emit-failed to=${to} notificationId=${created._id}`, err)
  }

  try {
    if (preferences && !preferences.pushEnabled) {
      logger.info(`push:skipped to=${to} reason=push-disabled title="${title}"`)
      return
    }

    // Digest mode (Phase 6): the in-app row above still lands normally —
    // only the individual push is withheld here, batched into one daily
    // summary by runNotificationDigestSweep instead. Mandatory categories
    // (e.g. the digest summary itself, 'account') are exempt, or a
    // digest-mode user would simply never get pushed at all.
    if (
      preferences &&
      preferences.digestMode === 'daily' &&
      category &&
      !MANDATORY_CATEGORIES.has(category)
    ) {
      logger.info(`push:skipped to=${to} reason=digest-batched category=${category} title="${title}"`)
      return
    }

    const tokens = await DeviceTokenServices.getTokensForUser(to)
    if (tokens.length === 0) {
      logger.info(`push:skipped to=${to} reason=no-registered-devices title="${title}"`)
      return
    }

    // notificationId/category/kind are here for the mobile client (Phase 11):
    // notificationId lets it dedupe against the same event arriving over the
    // existing Socket.IO channel while the app is foregrounded; category/kind
    // are what Phase 12's tap-to-navigate routing will switch on. None of
    // this is read server-side — FCM just carries it through as opaque
    // string data.
    const results = await sendPushNotification(tokens, title, body, {
      from: from.toString(),
      to: to.toString(),
      notificationId: created._id.toString(),
      ...(category && { category }),
      ...(payload.kind && { kind: payload.kind }),
    })
    const succeeded = results.filter(r => r.success).length
    const failed = results.length - succeeded
    logger.info(`push:attempted to=${to} devices=${results.length} succeeded=${succeeded} failed=${failed} title="${title}"`)

    const staleTokens = results.filter(r => !r.success && r.isTokenInvalid)
    if (staleTokens.length > 0) {
      await Promise.all(staleTokens.map(r => DeviceTokenServices.removeStaleToken(r.token)))
      logger.info(`push:stale-tokens-removed to=${to} count=${staleTokens.length}`)
    }
  } catch (err) {
    logger.error(`push:unexpected-failure to=${to} title="${title}"`, err)
  }
}
