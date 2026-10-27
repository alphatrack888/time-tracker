import { renderNotificationTemplate, renderNotificationTranslations, KIND_CATEGORY, MANDATORY_CATEGORIES, NotificationKind, APP_NOTIFICATION_LOCALES } from './notificationTemplates'

describe('renderNotificationTemplate (Phase 4: bilingual notification copy)', () => {
  it('renders English content for a known kind', () => {
    const { title, body } = renderNotificationTemplate('payrollCreated', 'en')
    expect(title).toBe('You have received a new payrole')
    expect(body).toContain('payrole')
  })

  it('renders German content for the same kind', () => {
    const { title, body } = renderNotificationTemplate('payrollCreated', 'de')
    expect(title).toBe('Sie haben eine neue Abrechnung erhalten')
    expect(body).toContain('Abrechnung')
  })

  it('falls back to English for an unsupported/unknown language code', () => {
    const enResult = renderNotificationTemplate('payrollCreated', 'en')
    const fallbackResult = renderNotificationTemplate('payrollCreated', 'fr')
    const undefinedResult = renderNotificationTemplate('payrollCreated', undefined)

    expect(fallbackResult).toEqual(enResult)
    expect(undefinedResult).toEqual(enResult)
  })

  it('interpolates data into both languages correctly', () => {
    const en = renderNotificationTemplate('leaveBalanceLow', 'en', { leaveType: 'casual', remaining: 1 })
    const de = renderNotificationTemplate('leaveBalanceLow', 'de', { leaveType: 'casual', remaining: 1 })

    expect(en.body).toBe('You have 1 casual leave day(s) remaining.')
    expect(de.body).toContain('1')
    expect(de.body).toContain('casual')
  })

  it('describes a forgotten clock-out as an open session and names the project when present', () => {
    const named = renderNotificationTemplate('forgotClockOut', 'en', {
      date: '2026-10-20',
      thresholdHours: 12,
      projectTitle: 'rewe',
    })
    const unnamed = renderNotificationTemplate('forgotClockOut', 'en', {
      date: '2026-10-20',
      thresholdHours: 12,
    })
    const namedDe = renderNotificationTemplate('forgotClockOut', 'de', {
      date: '2026-10-20',
      thresholdHours: 12,
      projectTitle: 'rewe',
    })

    expect(named.title).toBe('Did you forget to clock out?')
    expect(named.body).toContain('rewe')
    expect(named.body).toContain('still open')
    expect(named.body).toContain('started more than 12 hours ago')
    expect(named.body).not.toContain('after 12+')
    expect(unnamed.body).toContain('Your time session from 2026-10-20 is still open')
    expect(unnamed.body).not.toContain('rewe')
    expect(namedDe.body).toContain('rewe')
    expect(namedDe.body).toContain('noch offen')
    expect(namedDe.body).toContain('vor mehr als 12 Stunden gestartet')
  })

  it('translates the dynamic leave status word, not just the surrounding sentence', () => {
    const approvedEn = renderNotificationTemplate('leaveRequestStatusChanged', 'en', { status: 'approved', from: 'Jan 1', to: 'Jan 2' })
    const approvedDe = renderNotificationTemplate('leaveRequestStatusChanged', 'de', { status: 'approved', from: 'Jan 1', to: 'Jan 2' })
    const rejectedDe = renderNotificationTemplate('leaveRequestStatusChanged', 'de', { status: 'rejected', from: 'Jan 1', to: 'Jan 2' })

    expect(approvedEn.title).toBe('Your leave request has been approved')
    expect(approvedDe.title).toBe('Ihr Urlaubsantrag wurde genehmigt')
    expect(rejectedDe.title).toBe('Ihr Urlaubsantrag wurde abgelehnt')
  })

  it('every kind has both an English and a German template that render without throwing', () => {
    const allKinds = Object.keys(KIND_CATEGORY) as NotificationKind[]
    for (const kind of allKinds) {
      expect(() => renderNotificationTemplate(kind, 'en', { status: 'approved', leaveType: 'casual', remaining: 1 })).not.toThrow()
      expect(() => renderNotificationTemplate(kind, 'de', { status: 'approved', leaveType: 'casual', remaining: 1 })).not.toThrow()
    }
  })

  it('renders every app locale, keeping names and dates in the sentence', () => {
    const sample = {
      status: 'approved',
      leaveType: 'casual',
      remaining: 1,
      employeeName: 'Anna',
      from: 'Jan 1',
      to: 'Jan 2',
      projectTitle: 'rewe',
      startDate: 'Jan 1',
      endDate: 'Jan 2',
      companyName: 'Acme',
      hoursWorked: 10,
      plannedHours: 4,
      thresholdHours: 8,
      date: '2026-10-20',
      failureCount: 2,
      trialEndDate: 'Jan 9',
      reportLabel: 'weekly',
      count: 3,
    }
    const allKinds = Object.keys(KIND_CATEGORY) as NotificationKind[]
    for (const kind of allKinds) {
      const translations = renderNotificationTranslations(kind, sample)
      for (const locale of APP_NOTIFICATION_LOCALES) {
        expect(translations[locale].title.length).toBeGreaterThan(0)
        expect(translations[locale].body.length).toBeGreaterThan(0)
      }
    }

    const leave = renderNotificationTranslations('leaveRequestSubmitted', sample)
    expect(leave.english.title).toContain('Anna')
    expect(leave.arabic.title).toContain('Anna')
    expect(leave.romanian.body).toContain('Jan 1')
    expect(leave.arabic.title).not.toBe(leave.english.title)
    expect(leave.romanian.title).not.toBe(leave.english.title)
  })

  it('names the project in every overtime locale', () => {
    const data = { employeeName: 'Anna', projectTitle: 'Site', hoursWorked: '42.00', allocatedHours: '40.00' }
    for (const kind of ['overtimeEmployeeAlert', 'overtimeCompanyAlert'] as const) {
      const translations = renderNotificationTranslations(kind, data)
      for (const locale of APP_NOTIFICATION_LOCALES) {
        expect(translations[locale].body).toContain('Site')
        expect(translations[locale].body).toContain('42.00')
        expect(translations[locale].body).toContain('40.00')
      }
    }
  })

  it('every kind maps to exactly one category, and only "account" is mandatory', () => {
    expect(KIND_CATEGORY.employeeWelcome).toBe('account')
    expect(KIND_CATEGORY.newEmployeeAddedConfirmation).toBe('account')
    expect(KIND_CATEGORY.leaveRequestSubmitted).toBe('leave')
    expect(KIND_CATEGORY.overtimeEmployeeAlert).toBe('overtime')
    expect(MANDATORY_CATEGORIES.has('account')).toBe(true)
    expect(MANDATORY_CATEGORIES.has('leave')).toBe(false)
  })
})
