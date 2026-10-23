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

/** Languages the mobile app can select. Stored on each new notification. */
export type AppNotificationLocale = 'english' | 'german' | 'arabic' | 'romanian';
export type TemplateLanguage = 'en' | 'de' | 'ar' | 'ro';

export const APP_NOTIFICATION_LOCALES: readonly AppNotificationLocale[] = [
  'english',
  'german',
  'arabic',
  'romanian',
];

const TEMPLATE_LANGUAGE_BY_APP_LOCALE: Record<AppNotificationLocale, TemplateLanguage> = {
  english: 'en',
  german: 'de',
  arabic: 'ar',
  romanian: 'ro',
};

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

export type NotificationTranslations = Record<AppNotificationLocale, Rendered>;

const LEAVE_STATUS_TEXT: Record<TemplateLanguage, Record<string, string>> = {
  en: { approved: 'approved', rejected: 'rejected' },
  de: { approved: 'genehmigt', rejected: 'abgelehnt' },
  ar: { approved: 'تمت الموافقة عليه', rejected: 'تم رفضه' },
  ro: { approved: 'aprobată', rejected: 'respinsă' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateFn = (data: any) => Rendered;

const TEMPLATES: Record<NotificationKind, Record<TemplateLanguage, TemplateFn>> = {
  leaveRequestSubmitted: {
    en: ({ employeeName, from, to }) => ({
      title: `New Leave Request from ${employeeName}`,
      body: `${employeeName} has requested a leave from ${from} to ${to}`,
    }),
    de: ({ employeeName, from, to }) => ({
      title: `Neuer Urlaubsantrag von ${employeeName}`,
      body: `${employeeName} hat Urlaub von ${from} bis ${to} beantragt`,
    }),
    ar: ({ employeeName, from, to }) => ({
      title: `طلب إجازة جديد من ${employeeName}`,
      body: `طلب ${employeeName} إجازة من ${from} إلى ${to}`,
    }),
    ro: ({ employeeName, from, to }) => ({
      title: `Cerere nouă de concediu de la ${employeeName}`,
      body: `${employeeName} a solicitat concediu din ${from} până în ${to}`,
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
    ar: ({ status, from, to }) => ({
      title: `طلب إجازتك ${LEAVE_STATUS_TEXT.ar[status] || status}`,
      body: `طلب إجازتك من ${from} إلى ${to} ${LEAVE_STATUS_TEXT.ar[status] || status}`,
    }),
    ro: ({ status, from, to }) => ({
      title: `Cererea ta de concediu a fost ${LEAVE_STATUS_TEXT.ro[status] || status}`,
      body: `Cererea ta de concediu din ${from} până în ${to} a fost ${LEAVE_STATUS_TEXT.ro[status] || status}`,
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
    ar: ({ leaveType, remaining }) => ({
      title: 'رصيد الإجازة على وشك النفاد',
      body: `تبقّى لديك ${remaining} يوم/أيام من إجازة ${leaveType}.`,
    }),
    ro: ({ leaveType, remaining }) => ({
      title: 'Soldul de concediu este aproape epuizat',
      body: `Îți mai rămân ${remaining} zi/zile de concediu ${leaveType}.`,
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
    ar: ({ leaveType }) => ({
      title: 'نفد رصيد الإجازة',
      body: `لم يتبقَّ لديك أيام إجازة ${leaveType}.`,
    }),
    ro: ({ leaveType }) => ({
      title: 'Soldul de concediu este epuizat',
      body: `Nu îți mai rămân zile de concediu ${leaveType}.`,
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
    ar: ({ projectTitle, startDate, endDate }) => ({
      title: `تمت إضافتك إلى ${projectTitle}`,
      body: `تمت إضافتك إلى "${projectTitle}". البداية: ${startDate}، النهاية: ${endDate}.`,
    }),
    ro: ({ projectTitle, startDate, endDate }) => ({
      title: `Ai fost adăugat la ${projectTitle}`,
      body: `Ai fost adăugat la „${projectTitle}”. Început: ${startDate}, sfârșit: ${endDate}.`,
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
    ar: ({ projectTitle }) => ({
      title: `تمت إزالتك من "${projectTitle}"`,
      body: `تمت إزالتك من المشروع "${projectTitle}". إذا لم يكن هذا متوقعًا، يرجى التواصل مع مديرك.`,
    }),
    ro: ({ projectTitle }) => ({
      title: `Ai fost eliminat din „${projectTitle}”`,
      body: `Ai fost eliminat din proiectul „${projectTitle}”. Dacă nu te așteptai la asta, contactează managerul.`,
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
    ar: () => ({
      title: 'لقد استلمت كشف راتب جديد',
      body: 'تم تعيين كشف راتب جديد لك. يرجى الاطلاع على المستند لمزيد من التفاصيل.',
    }),
    ro: () => ({
      title: 'Ai primit o nouă fișă de plată',
      body: 'Ți-a fost atribuită o nouă fișă de plată. Vezi documentul pentru mai multe detalii.',
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
    ar: ({ companyName }) => ({
      title: `مرحبًا بك في ${companyName || 'الفريق'}!`,
      body: 'تم إنشاء حسابك. تحقق من بريدك الإلكتروني لبيانات تسجيل الدخول للبدء.',
    }),
    ro: ({ companyName }) => ({
      title: `Bine ai venit la ${companyName || 'echipă'}!`,
      body: 'Contul tău a fost creat. Verifică e-mailul pentru datele de autentificare.',
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
    ar: ({ employeeName }) => ({
      title: 'تمت إضافة موظف جديد',
      body: `تمت إضافة ${employeeName} إلى شركتك.`,
    }),
    ro: ({ employeeName }) => ({
      title: 'Angajat nou adăugat',
      body: `${employeeName} a fost adăugat în compania ta.`,
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
    ar: ({ hoursWorked, thresholdHours }) => ({
      title: 'تنبيه عمل إضافي',
      body: `لقد عملت ${hoursWorked} س اليوم، فوق الحد اليومي البالغ ${thresholdHours} س.`,
    }),
    ro: ({ hoursWorked, thresholdHours }) => ({
      title: 'Alertă de ore suplimentare',
      body: `Ai lucrat ${hoursWorked} h astăzi, peste pragul zilnic de ${thresholdHours} h.`,
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
    ar: ({ employeeName, hoursWorked, thresholdHours }) => ({
      title: `تنبيه عمل إضافي: ${employeeName}`,
      body: `عمل ${employeeName} ${hoursWorked} س اليوم، فوق الحد اليومي البالغ ${thresholdHours} س.`,
    }),
    ro: ({ employeeName, hoursWorked, thresholdHours }) => ({
      title: `Alertă de ore suplimentare: ${employeeName}`,
      body: `${employeeName} a lucrat ${hoursWorked} h astăzi, peste pragul zilnic de ${thresholdHours} h.`,
    }),
  },
  forgotClockOut: {
    en: ({ date, thresholdHours, projectTitle }) => {
      const named = typeof projectTitle === 'string' && projectTitle.trim().length > 0
      const subject = named ? `Your ${projectTitle.trim()} session` : 'Your time session'
      return {
        title: 'Did you forget to clock out?',
        body: `${subject} from ${date} is still open. It was started more than ${thresholdHours} hours ago. Please clock out, or contact your manager if this is a mistake.`,
      }
    },
    de: ({ date, thresholdHours, projectTitle }) => {
      const named = typeof projectTitle === 'string' && projectTitle.trim().length > 0
      const subject = named
        ? `Ihre Zeiterfassung für ${projectTitle.trim()}`
        : 'Ihre Zeiterfassung'
      return {
        title: 'Haben Sie vergessen, sich abzumelden?',
        body: `${subject} vom ${date} ist noch offen. Sie wurde vor mehr als ${thresholdHours} Stunden gestartet. Bitte melden Sie sich ab oder kontaktieren Sie Ihren Manager, falls dies ein Versehen ist.`,
      }
    },
    ar: ({ date, thresholdHours, projectTitle }) => {
      const named = typeof projectTitle === 'string' && projectTitle.trim().length > 0
      const subject = named ? `جلسة ${projectTitle.trim()} الخاصة بك` : 'جلسة الوقت الخاصة بك'
      return {
        title: 'هل نسيت تسجيل الخروج؟',
        body: `${subject} من ${date} لا تزال مفتوحة. بدأت منذ أكثر من ${thresholdHours} ساعة. يرجى تسجيل الخروج، أو التواصل مع مديرك إذا كان هذا خطأ.`,
      }
    },
    ro: ({ date, thresholdHours, projectTitle }) => {
      const named = typeof projectTitle === 'string' && projectTitle.trim().length > 0
      const subject = named ? `Sesiunea ta pentru ${projectTitle.trim()}` : 'Sesiunea ta de pontaj'
      return {
        title: 'Ai uitat să închizi pontajul?',
        body: `${subject} din ${date} este încă deschisă. A fost începută cu mai mult de ${thresholdHours} ore în urmă. Te rugăm să închizi pontajul sau să contactezi managerul dacă este o greșeală.`,
      }
    },
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
    ar: ({ failureCount }) => ({
      title: 'مشكلة في دفع اشتراكك',
      body: `حدثت ${failureCount} محاولات دفع فاشلة لاشتراكك. يرجى تحديث طريقة الدفع لتجنب انقطاع الخدمة.`,
    }),
    ro: ({ failureCount }) => ({
      title: 'Problemă de plată la abonament',
      body: `Au existat ${failureCount} încercări de plată eșuate pentru abonamentul tău. Actualizează metoda de plată pentru a evita întreruperea serviciului.`,
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
    ar: ({ trialEndDate }) => ({
      title: 'فترتك التجريبية تنتهي قريبًا',
      body: `تنتهي فترتك التجريبية في ${trialEndDate}. أضف طريقة دفع لإبقاء اشتراكك نشطًا دون انقطاع.`,
    }),
    ro: ({ trialEndDate }) => ({
      title: 'Perioada ta de probă se încheie în curând',
      body: `Perioada ta de probă se încheie pe ${trialEndDate}. Adaugă o metodă de plată ca abonamentul să rămână activ fără întrerupere.`,
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
    ar: ({ reportLabel }) => ({
      title: 'تقريرك جاهز',
      body: `اكتمل إنشاء تقرير ${reportLabel} وهو جاهز للتنزيل.`,
    }),
    ro: ({ reportLabel }) => ({
      title: 'Raportul tău este gata',
      body: `Raportul tău ${reportLabel} a fost generat și este gata de descărcare.`,
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
    ar: ({ reportLabel }) => ({
      title: 'تعذّر إنشاء تقريرك',
      body: `حدث خطأ أثناء إنشاء تقرير ${reportLabel}. يرجى المحاولة مرة أخرى، أو التواصل مع الدعم إذا استمرت المشكلة.`,
    }),
    ro: ({ reportLabel }) => ({
      title: 'Raportul tău nu a putut fi generat',
      body: `A apărut o eroare la generarea raportului ${reportLabel}. Încearcă din nou sau contactează suportul dacă problema persistă.`,
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
    ar: ({ count }) => ({
      title: 'ملخص إشعاراتك اليومي',
      body: count === 1
        ? `لديك ${count} إشعار جديد في التطبيق.`
        : `لديك ${count} إشعارات جديدة في التطبيق.`,
    }),
    ro: ({ count }) => ({
      title: 'Rezumatul tău zilnic de notificări',
      body: count === 1
        ? `Ai ${count} notificare nouă în aplicație.`
        : `Ai ${count} notificări noi în aplicație.`,
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

/** Renders the same notification in every language the app can select. */
export const renderNotificationTranslations = (
  kind: NotificationKind,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> = {},
): NotificationTranslations => {
  const translations = {} as NotificationTranslations;
  for (const locale of APP_NOTIFICATION_LOCALES) {
    translations[locale] = TEMPLATES[kind][TEMPLATE_LANGUAGE_BY_APP_LOCALE[locale]](data);
  }
  return translations;
};

export const normalizeNotificationLocale = (locale: unknown): AppNotificationLocale => {
  if (
    locale === 'english' ||
    locale === 'german' ||
    locale === 'arabic' ||
    locale === 'romanian'
  ) {
    return locale;
  }
  return 'english';
};
