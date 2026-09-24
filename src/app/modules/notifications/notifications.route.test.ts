import request from 'supertest'
import app from '../../../app'
import { Notification } from './notifications.model'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES } from '../../../enum/user'

describe('Notification routes (Phase 0 fix: GET -> PATCH, /all not shadowed by /:id)', () => {
  it('marks a single notification as read via PATCH /api/v1/notifications/:id', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const notification = await Notification.create({
      to: authId,
      from: authId,
      title: 'Test',
      body: 'Body',
      isRead: false,
    })

    const res = await request(app)
      .patch(`/api/v1/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const updated = await Notification.findById(notification._id)
    expect(updated?.isRead).toBe(true)
  })

  it('marks all notifications as read via PATCH /api/v1/notifications/all, without being captured by /:id', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })
    await Notification.create([
      { to: authId, from: authId, title: 'A', body: 'a', isRead: false },
      { to: authId, from: authId, title: 'B', body: 'b', isRead: false },
    ])

    const res = await request(app)
      .patch('/api/v1/notifications/all')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    const remaining = await Notification.countDocuments({ to: authId, isRead: false })
    expect(remaining).toBe(0)
  })

  it('no longer accepts GET for mark-as-read (old broken contract removed)', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const notification = await Notification.create({
      to: authId,
      from: authId,
      title: 'Test',
      body: 'Body',
      isRead: false,
    })

    const res = await request(app)
      .get(`/api/v1/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${token}`)

    // GET / (list) exists, but GET /:id no longer maps to the mark-as-read
    // handler; falls through to the app's catch-all 404.
    expect(res.status).toBe(404)
  })

  it('does not mark another user\'s notification as read', async () => {
    const owner = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const attacker = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const notification = await Notification.create({
      to: owner.authId,
      from: owner.authId,
      title: 'Private',
      body: 'body',
      isRead: false,
    })

    const res = await request(app)
      .patch(`/api/v1/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${attacker.token}`)

    expect(res.status).toBe(404)

    const stillUnread = await Notification.findById(notification._id)
    expect(stillUnread?.isRead).toBe(false)
  })
})

describe('Notification routes — role access (Phase 12 fix: COMPANY/SUPER_ADMIN were silently 403ing)', () => {
  it.each([USER_ROLES.EMPLOYEES, USER_ROLES.COMPANY, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN])(
    'lets a %s list their own notifications via GET /api/v1/notifications',
    async role => {
      const { authId, token } = signTestToken({ role })
      await Notification.create({ to: authId, from: authId, title: 'T', body: 'B', isRead: false })

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.data).toHaveLength(1)
    },
  )

  it.each([USER_ROLES.COMPANY, USER_ROLES.SUPER_ADMIN])(
    'lets a %s mark a notification read via PATCH /api/v1/notifications/:id (previously 403)',
    async role => {
      const { authId, token } = signTestToken({ role })
      const notification = await Notification.create({ to: authId, from: authId, title: 'T', body: 'B', isRead: false })

      const res = await request(app)
        .patch(`/api/v1/notifications/${notification._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      const updated = await Notification.findById(notification._id)
      expect(updated?.isRead).toBe(true)
    },
  )

  it.each([USER_ROLES.COMPANY, USER_ROLES.SUPER_ADMIN])(
    'lets a %s mark all notifications read via PATCH /api/v1/notifications/all (previously 403)',
    async role => {
      const { authId, token } = signTestToken({ role })
      await Notification.create({ to: authId, from: authId, title: 'T', body: 'B', isRead: false })

      const res = await request(app)
        .patch('/api/v1/notifications/all')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      const remaining = await Notification.countDocuments({ to: authId, isRead: false })
      expect(remaining).toBe(0)
    },
  )
})

describe('GET /api/v1/notifications — meta.unreadCount (Phase 12)', () => {
  it('reflects every unread notification, not just the current page', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })
    // 3 unread + 1 read, fetched one page at a time (limit=2) — the unread
    // count must stay the true total regardless of page size/position.
    await Notification.create([
      { to: authId, from: authId, title: 'A', body: 'a', isRead: false },
      { to: authId, from: authId, title: 'B', body: 'b', isRead: false },
      { to: authId, from: authId, title: 'C', body: 'c', isRead: false },
      { to: authId, from: authId, title: 'D', body: 'd', isRead: true },
    ])

    const page1 = await request(app)
      .get('/api/v1/notifications?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`)
    const page2 = await request(app)
      .get('/api/v1/notifications?page=2&limit=2')
      .set('Authorization', `Bearer ${token}`)

    expect(page1.body.data.meta.unreadCount).toBe(3)
    expect(page2.body.data.meta.unreadCount).toBe(3)
    expect(page1.body.data.meta.total).toBe(4)
  })

  it('drops to 0 after mark-all-read, independent of total', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })
    await Notification.create([
      { to: authId, from: authId, title: 'A', body: 'a', isRead: false },
      { to: authId, from: authId, title: 'B', body: 'b', isRead: false },
    ])

    await request(app).patch('/api/v1/notifications/all').set('Authorization', `Bearer ${token}`)

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.data.meta.unreadCount).toBe(0)
    expect(res.body.data.meta.total).toBe(2)
  })
})

describe('GET /api/v1/notifications — rate limiting (Phase 14 audit)', () => {
  it('is actually rate-limited, not just theoretically covered by unused middleware code', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)

    // rateLimitMiddleware existed in the codebase before Phase 14 but was
    // wired into zero routes (confirmed by grepping the whole src tree) —
    // this header only appears if the middleware is actually in the chain.
    expect(res.headers['x-ratelimit-limit']).toBeDefined()
  })
})
