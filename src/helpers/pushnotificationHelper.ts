import admin from "firebase-admin";
import config from "../config";
import { logger } from "../shared/logger";

let firebaseInitialized = false;

try {
  if (config.firebase_service_account_base64) {
    const serviceAccountJson = Buffer.from(
      config.firebase_service_account_base64,
      "base64"
    ).toString("utf8");
    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    firebaseInitialized = true;
    logger.info("Firebase Admin initialized successfully");
  } else {
    logger.warn("Firebase Service Account Base64 is missing in configuration");
  }
} catch (error: unknown) {
  logger.error("Failed to initialize Firebase Admin:", error instanceof Error ? error.message : error);
}

/** Exposed so callers (and tests) can tell "no devices" apart from "Firebase isn't configured, so nothing was even attempted." */
export const isFirebasePushConfigured = (): boolean => firebaseInitialized;

type NotificationData = { [key: string]: string };

export type PushSendResult = {
  token: string;
  success: boolean;
  /** A stable FCM error code (e.g. 'messaging/registration-token-not-registered'), never the raw error object — kept log-safe. */
  errorCode?: string;
  /** True when FCM says this token will never succeed again and should be removed from DeviceToken. */
  isTokenInvalid?: boolean;
};

// FCM's own multicast call accepts at most 500 tokens.
const FCM_MULTICAST_LIMIT = 500;

// FCM's total notification payload cap is ~4KB; keep the body well under
// that so a long, user-authored string (e.g. a leave request reason) can
// never blow up the send. The full, untruncated text still lives in the
// Notification document for the in-app view — this only affects the OS
// push banner.
const MAX_PUSH_BODY_LENGTH = 500;

export const truncateForPush = (body: string): string => {
  if (body.length <= MAX_PUSH_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_PUSH_BODY_LENGTH - 1)}…`;
};

// FCM error codes that mean "this token is dead, stop sending to it" as
// opposed to a transient failure worth leaving alone.
const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Sends one push to every token in `tokens`, batched to respect FCM's
 * 500-token-per-call multicast limit. Never throws: a send failure (or
 * Firebase not being configured at all, e.g. in local dev) is reported
 * per-token in the returned array instead, so the caller can log/clean up
 * without the business operation that triggered the notification ever
 * failing because of it.
 */
export const sendPushNotification = async (
  tokens: string[],
  title: string,
  body: string,
  data: NotificationData,
  icon?: string
): Promise<PushSendResult[]> => {
  if (tokens.length === 0) return [];

  if (!firebaseInitialized) {
    logger.warn(`Push skipped (Firebase not configured): ${tokens.length} token(s), title="${title}"`);
    return tokens.map(token => ({ token, success: false, errorCode: "firebase-not-configured" }));
  }

  const safeBody = truncateForPush(body);
  const results: PushSendResult[] = [];

  // Groups related pushes into one collapsible thread in iOS's Notification
  // Center (Apple's `thread-id`) instead of a flood of separate banners
  // when several arrive close together (e.g. multiple leave requests) —
  // Android gets the equivalent behavior from the single default
  // notification channel configured client-side (AndroidManifest.xml).
  const threadId = data.category || 'general';

  for (const batch of chunk(tokens, FCM_MULTICAST_LIMIT)) {
    const message: admin.messaging.MulticastMessage = {
      tokens: batch,
      notification: { title, body: safeBody },
      data,
      ...(icon && {
        android: { notification: { icon } },
      }),
      apns: {
        payload: {
          aps: { "mutable-content": 1, threadId },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      response.responses.forEach((r, idx) => {
        const token = batch[idx];
        if (r.success) {
          results.push({ token, success: true });
        } else {
          const errorCode = r.error?.code;
          results.push({
            token,
            success: false,
            errorCode,
            isTokenInvalid: errorCode ? INVALID_TOKEN_ERROR_CODES.has(errorCode) : false,
          });
        }
      });
      logger.info(
        `Push batch sent: ${response.successCount} succeeded, ${response.failureCount} failed (of ${batch.length})`,
      );
    } catch (error: unknown) {
      // The whole batch call itself failed (e.g. FCM outage) rather than
      // any individual token being rejected — every token in this batch is
      // reported failed, none are treated as invalid/removable.
      logger.error(
        `Push batch failed entirely: tokens=${batch.length} title="${title}"`,
        error instanceof Error ? error.message : error,
      );
      batch.forEach(token => results.push({ token, success: false, errorCode: "batch-send-failed" }));
    }
  }

  return results;
};
