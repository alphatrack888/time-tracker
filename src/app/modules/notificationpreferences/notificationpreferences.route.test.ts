import request from 'supertest'
import app from '../../../app'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { User } from '../user/user.model'
import { NotificationPreference } from './notificationpreferences.model'

describe('Notification preference routes (Phase 4)', () => {
  it('defaults to all-enabled for a user with no preference record yet', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .get('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      pushEnabled: true,
      categories: {
        leave: true,
        project: true,
        payroll: true,
        overtime: true,
        attendance: true,
        subscription: true,
      },
      digestMode: 'realtime',
      language: 'en',
    })
  })

  it('persists a partial category update and leaves the rest untouched', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const patchRes = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ categories: { leave: false } })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.categories.leave).toBe(false)
    expect(patchRes.body.data.categories.project).toBe(true)

    const stored = await NotificationPreference.findOne({ user: authId })
    expect(stored?.categories.leave).toBe(false)
    expect(stored?.categories.project).toBe(true)
  })

  it('persists the pushEnabled kill switch', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushEnabled: false })

    expect(res.status).toBe(200)
    expect(res.body.data.pushEnabled).toBe(false)
  })

  it('persists a language change to the User document', async () => {
    // Needs a real backing User document — signTestToken's authId alone has
    // nothing in the DB for the language update to land on.
    const seededUser = await User.create({
      name: 'Language Test User',
      email: `language-test-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES, authId: seededUser._id.toString() })

    const res = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'de' })

    expect(res.status).toBe(200)
    expect(res.body.data.language).toBe('de')

    const updatedUser = await User.findById(authId).select('language')
    expect(updatedUser?.language).toBe('de')
  })

  it('persists digestMode (Phase 6)', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ digestMode: 'daily' })

    expect(res.status).toBe(200)
    expect(res.body.data.digestMode).toBe('daily')

    const getRes = await request(app)
      .get('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
    expect(getRes.body.data.digestMode).toBe('daily')
  })

  it('rejects an unsupported digestMode value', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ digestMode: 'weekly' })

    expect(res.status).toBe(400)
  })

  it('rejects an unknown category key rather than silently accepting or dropping it', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      // 'account' is mandatory and deliberately has no toggle at all.
      .send({ categories: { account: false } })

    expect(res.status).toBe(400)
  })

  it('rejects an unsupported language code', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'fr' })

    expect(res.status).toBe(400)
  })

  it('scopes preferences to the requesting user — one user cannot see or affect another\'s', async () => {
    const userA = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const userB = signTestToken({ role: USER_ROLES.EMPLOYEES })

    await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ categories: { leave: false } })

    const bRes = await request(app)
      .get('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${userB.token}`)

    expect(bRes.body.data.categories.leave).toBe(true)
  })
})
