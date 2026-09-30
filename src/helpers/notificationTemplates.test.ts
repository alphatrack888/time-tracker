import { renderNotificationTemplate, KIND_CATEGORY, MANDATORY_CATEGORIES, NotificationKind } from './notificationTemplates'

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

  it('every kind maps to exactly one category, and only "account" is mandatory', () => {
    expect(KIND_CATEGORY.employeeWelcome).toBe('account')
    expect(KIND_CATEGORY.newEmployeeAddedConfirmation).toBe('account')
    expect(KIND_CATEGORY.leaveRequestSubmitted).toBe('leave')
    expect(KIND_CATEGORY.overtimeEmployeeAlert).toBe('overtime')
    expect(MANDATORY_CATEGORIES.has('account')).toBe(true)
    expect(MANDATORY_CATEGORIES.has('leave')).toBe(false)
  })
})
