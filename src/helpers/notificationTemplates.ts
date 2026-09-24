/**
 * Central catalogue of notification copy (integration plan Phase 4). Every
 * trigger renders its title/body through here instead of hand-writing
 * strings inline, so (a) English and German stay in one place instead of
 * scattered across every trigger's call site, and (b) every kind maps to
 * exactly one preference category — a caller can't tag a notification with
 * the wrong category by hand.
 */

export type SupportedLanguage = 'en' | 'de';
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export type NotificationCategory =
  | 'leave'
  | 'project'
  | 'payroll'
  | 'overtime'
  | 'attendance'
  | 'subscription'
  | 'account'
  | 'report';

export type NotificationKind =
  | 'leaveRequestSubmitted'
  | 'leaveRequestStatusChanged'
  | 'leaveBalanceLow'
  | 'leaveBalanceExhausted'
  | 'projectEmployeeAdded'
  | 'projectEmployeeRemoved'
  | 'payrollCreated'
  | 'employeeWelcome'
  | 'newEmployeeAddedConfirmation'
  | 'overtimeEmployeeAlert'
  | 'overtimeCompanyAlert'
  | 'forgotClockOut'
  | 'subscriptionPaymentFailure'
  | 'subscriptionTrialEnding'
  | 'reportReady'
  | 'reportFailed'
  | 'notificationDigest';

export const KIND_CATEGORY: Record<NotificationKind, NotificationCategory> = {
  leaveRequestSubmitted: 'leave',
  leaveRequestStatusChanged: 'leave',
  leaveBalanceLow: 'leave',
  leaveBalanceExhausted: 'leave',
  projectEmployeeAdded: 'project',
  projectEmployeeRemoved: 'project',
  payrollCreated: 'payroll',
  employeeWelcome: 'account',
  newEmployeeAddedConfirmation: 'account',
  overtimeEmployeeAlert: 'overtime',
  overtimeCompanyAlert: 'overtime',
  forgotClockOut: 'attendance',
  subscriptionPaymentFailure: 'subscription',
  subscriptionTrialEnding: 'subscription',
  reportReady: 'report',
  reportFailed: 'report',
  // Mapped to 'account' rather than a new category: a digest summary only
  // ever fires for a user who explicitly turned digestMode on themselves
  // (see notificationpreferences.service.ts) — there's no separate
  // preference to gate it on beyond that opt-in.
  notificationDigest: 'account',
};

// Categories a user can never opt out of: account-lifecycle notifications
// (employee onboarding), and the result of a report the user themselves
// just requested — opting out of "your report is ready" isn't a
// meaningful preference the way "notify me about overtime" is. Enforced
// here so the preferences service can't accidentally expose a toggle for
// one even if someone adds it to the validation schema later without
// checking here first.
export const MANDATORY_CATEGORIES: ReadonlySet<NotificationCategory> = new Set(['account', 'report']);

type Rendered = { title: string; body: string };

const LEAVE_STATUS_TEXT: Record<SupportedLanguage, Record<string, string>> = {
  en: { approved: 'approved', rejected: 'rejected' },
  de: { approved: 'genehmigt', rejected: 'abgelehnt' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateFn = (data: any) => Rendered;

const TEMPLATES: Record<NotificationKind, Record<SupportedLanguage, TemplateFn>> = {
  leaveRequestSubmitted: {
    en: ({ employeeName, from, to }) => ({
      title: `New Leave Request from ${employeeName}`,
      body: `${employeeName} has requested a leave from ${from} to ${to}`,
    }),
    de: ({ employeeName, from, to }) => ({
      title: `Neuer Urlaubsantrag von ${employeeName}`,
      body: `${employeeName} hat Urlaub von ${from} bis ${to} beantragt`,
    }),
  },
  leaveRequestStatusChanged: {
    en: ({ status, from, to }) => ({
      title: `Your leave request has been ${LEAVE_STATUS_TEXT.en[status] || status}`,
      body: `Your leave request from ${from} to ${to} has been ${LEAVE_STATUS_TEXT.en[status] || status}`,
    }),
    de: ({ status, from, to }) => ({
      title: `Ihr Urlaubsantrag wurde ${LEAVE_STATUS_TEXT.de[status] || status}`,
      body: `Ihr Urlaubsantrag vom ${from} bis ${to} wurde ${LEAVE_STATUS_TEXT.de[status] || status}`,
    }),
  },
  leaveBalanceLow: {
    en: ({ leaveType, remaining }) => ({
      title: 'Leave balance running low',
      body: `You have ${remaining} ${leaveType} leave day(s) remaining.`,
    }),
    de: ({ leaveType, remaining }) => ({
      title: 'Urlaubskontingent wird knapp',
      body: `Sie haben noch ${remaining} Tag(e) ${leaveType}-Urlaub übrig.`,
    }),
  },
  leaveBalanceExhausted: {
    en: ({ leaveType }) => ({
      title: 'Leave balance exhausted',
      body: `You have no ${leaveType} leave days remaining.`,
    }),
    de: ({ leaveType }) => ({
      title: 'Urlaubskontingent aufgebraucht',
      body: `Sie haben keine ${leaveType}-Urlaubstage mehr übrig.`,
    }),
  },
  projectEmployeeAdded: {
    en: ({ projectTitle, startDate, endDate }) => ({
      title: `You've been added to ${projectTitle}`,
      body: `You've been added to "${projectTitle}". Start: ${startDate}, End: ${endDate}.`,
    }),
    de: ({ projectTitle, startDate, endDate }) => ({
      title: `Sie wurden zu ${projectTitle} hinzugefügt`,
      body: `Sie wurden zu „${projectTitle}“ hinzugefügt. Start: ${startDate}, Ende: ${endDate}.`,
    }),
  },
  projectEmployeeRemoved: {
    en: ({ projectTitle }) => ({
      title: `You've been removed from "${projectTitle}"`,
      body: `You've been removed from the project "${projectTitle}". If this was unexpected, please contact your manager.`,
    }),
    de: ({ projectTitle }) => ({
      title: `Sie wurden von „${projectTitle}“ entfernt`,
      body: `Sie wurden vom Projekt „${projectTitle}“ entfernt. Falls dies unerwartet ist, wenden Sie sich bitte an Ihren Manager.`,
    }),
  },
  payrollCreated: {
    en: () => ({
      title: 'You have received a new payrole',
      body: 'You have been assigned a new payrole, please see the document for more details',
    }),
    de: () => ({
      title: 'Sie haben eine neue Abrechnung erhalten',
      body: 'Ihnen wurde eine neue Abrechnung zugewiesen. Weitere Details finden Sie im Dokument.',
    }),
  },
  employeeWelcome: {
    en: ({ companyName }) => ({
      title: `Welcome to ${companyName || 'the team'}!`,
      body: 'Your account has been created. Check your email for login details to get started.',
    }),
    de: ({ companyName }) => ({
      title: `Willkommen bei ${companyName || 'unserem Team'}!`,
      body: 'Ihr Konto wurde erstellt. Ihre Zugangsdaten finden Sie in Ihrer E-Mail.',
    }),
  },
  newEmployeeAddedConfirmation: {
    en: ({ employeeName }) => ({
      title: 'New employee added',
      body: `${employeeName} has been added to your company.`,
    }),
    de: ({ employeeName }) => ({
      title: 'Neuer Mitarbeiter hinzugefügt',
      body: `${employeeName} wurde Ihrem Unternehmen hinzugefügt.`,
    }),
  },
  overtimeEmployeeAlert: {
    en: ({ hoursWorked, thresholdHours }) => ({
      title: 'Overtime alert',
      body: `You've worked ${hoursWorked}h today, over the ${thresholdHours}h daily threshold.`,
    }),
    de: ({ hoursWorked, thresholdHours }) => ({
      title: 'Überstunden-Hinweis',
      body: `Sie haben heute ${hoursWorked} Std. gearbeitet, über dem Tagesgrenzwert von ${thresholdHours} Std.`,
    }),
  },
  overtimeCompanyAlert: {
    en: ({ employeeName, hoursWorked, thresholdHours }) => ({
      title: `Overtime alert: ${employeeName}`,
      body: `${employeeName} has worked ${hoursWorked}h today, over the ${thresholdHours}h daily threshold.`,
    }),
    de: ({ employeeName, hoursWorked, thresholdHours }) => ({
      title: `Überstunden-Hinweis: ${employeeName}`,
      body: `${employeeName} hat heute ${hoursWorked} Std. gearbeitet, über dem Tagesgrenzwert von ${thresholdHours} Std.`,
    }),
  },
  forgotClockOut: {
    en: ({ date, thresholdHours }) => ({
      title: 'Did you forget to clock out?',
      body: `Your time session from ${date} is still open after ${thresholdHours}+ hours. Please clock out, or contact your manager if this is a mistake.`,
    }),
    de: ({ date, thresholdHours }) => ({
      title: 'Haben Sie vergessen, sich abzumelden?',
      body: `Ihre Zeiterfassung vom ${date} ist seit über ${thresholdHours} Stunden noch offen. Bitte melden Sie sich ab oder kontaktieren Sie Ihren Manager, falls dies ein Versehen ist.`,
    }),
  },
  subscriptionPaymentFailure: {
    en: ({ failureCount }) => ({
      title: 'Payment issue with your subscription',
      body: `We've had ${failureCount} failed payment attempts on your subscription. Please update your payment method to avoid service interruption.`,
    }),
    de: ({ failureCount }) => ({
      title: 'Zahlungsproblem bei Ihrem Abonnement',
      body: `Es gab ${failureCount} fehlgeschlagene Zahlungsversuche für Ihr Abonnement. Bitte aktualisieren Sie Ihre Zahlungsmethode, um eine Unterbrechung zu vermeiden.`,
    }),
  },
  subscriptionTrialEnding: {
    en: ({ trialEndDate }) => ({
      title: 'Your trial is ending soon',
      body: `Your trial ends on ${trialEndDate}. Add a payment method to keep your subscription active without interruption.`,
    }),
    de: ({ trialEndDate }) => ({
      title: 'Ihre Testphase endet bald',
      body: `Ihre Testphase endet am ${trialEndDate}. Hinterlegen Sie eine Zahlungsmethode, damit Ihr Abonnement ohne Unterbrechung aktiv bleibt.`,
    }),
  },
  reportReady: {
    en: ({ reportLabel }) => ({
      title: 'Your report is ready',
      body: `Your ${reportLabel} report has finished generating and is ready to download.`,
    }),
    de: ({ reportLabel }) => ({
      title: 'Ihr Bericht ist fertig',
      body: `Ihr ${reportLabel}-Bericht wurde erstellt und steht zum Download bereit.`,
    }),
  },
  reportFailed: {
    en: ({ reportLabel }) => ({
      title: 'Your report could not be generated',
      body: `Something went wrong generating your ${reportLabel} report. Please try again, or contact support if this keeps happening.`,
    }),
    de: ({ reportLabel }) => ({
      title: 'Ihr Bericht konnte nicht erstellt werden',
      body: `Beim Erstellen Ihres ${reportLabel}-Berichts ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.`,
    }),
  },
  notificationDigest: {
    en: ({ count }) => ({
      title: 'Your daily notification summary',
      body: `You have ${count} new notification${count === 1 ? '' : 's'} waiting for you in the app.`,
    }),
    de: ({ count }) => ({
      title: 'Ihre tägliche Benachrichtigungsübersicht',
      body: `Sie haben ${count} neue Benachrichtigung${count === 1 ? '' : 'en'} in der App.`,
    }),
  },
};

/**
 * Renders a notification's title/body for the given kind, language, and
 * interpolation data. Falls back to English for an unsupported/missing
 * language rather than throwing — a bad/legacy `User.language` value must
 * never prevent a notification from being sent.
 */
export const renderNotificationTemplate = (
  kind: NotificationKind,
  lang: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> = {},
): Rendered => {
  const resolvedLang: SupportedLanguage = lang === 'de' ? 'de' : DEFAULT_LANGUAGE;
  return TEMPLATES[kind][resolvedLang](data);
};
