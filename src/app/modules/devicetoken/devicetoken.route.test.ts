import request from 'supertest'
import app from '../../../app'
import { DeviceToken } from './devicetoken.model'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES } from '../../../enum/user'

describe('Device token routes (Phase 1: multi-device push token registration)', () => {
  it('registers a new device token for the authenticated user', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'fcm-token-abc123456', platform: 'android', appVersion: '1.2.3' })

    expect(res.status).toBe(200)

    const stored = await DeviceToken.findOne({ token: 'fcm-token-abc123456' })
    expect(stored).not.toBeNull()
    expect(stored?.user.toString()).toBe(authId)
    expect(stored?.platform).toBe('android')
    expect(stored?.appVersion).toBe('1.2.3')

    // Confirms rateLimitMiddleware (Phase 14 audit) is actually wired into
    // this route, not just present as unused code elsewhere in the repo —
    // the header is only set by that middleware.
    expect(res.headers['x-ratelimit-limit']).toBeDefined()
  })

  it('rejects registration without a token (validation)', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'ios' })

    expect(res.status).toBe(400)
  })

  it('rejects requests with no auth token at all', async () => {
    const res = await request(app)
      .post('/api/v1/devices/register')
      .send({ token: 'fcm-token-no-auth-header' })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('supports multiple devices for the same user', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'device-1-multi', platform: 'ios' })
    await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'device-2-multi', platform: 'android' })

    const listRes = await request(app)
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${token}`)

    expect(listRes.status).toBe(200)
    const tokens = listRes.body.data.map((d: { token: string }) => d.token)
    expect(tokens).toEqual(expect.arrayContaining(['device-1-multi', 'device-2-multi']))

    const owned = await DeviceToken.countDocuments({ user: authId })
    expect(owned).toBe(2)
  })

  it('reassigns a token to a new user when re-registered by someone else (shared/kiosk device)', async () => {
    const userA = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const userB = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const sharedToken = 'shared-kiosk-device-token'

    await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ token: sharedToken, platform: 'android' })

    let doc = await DeviceToken.findOne({ token: sharedToken })
    expect(doc?.user.toString()).toBe(userA.authId)

    // User B logs into the same physical device next.
    await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ token: sharedToken, platform: 'android' })

    doc = await DeviceToken.findOne({ token: sharedToken })
    expect(doc?.user.toString()).toBe(userB.authId)

    // Exactly one row for that token — not a duplicate.
    const count = await DeviceToken.countDocuments({ token: sharedToken })
    expect(count).toBe(1)

    // User A no longer sees it in their own device list.
    const aList = await request(app)
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${userA.token}`)
    expect(aList.body.data.map((d: { token: string }) => d.token)).not.toContain(sharedToken)
  })

  it('deregisters the current user\'s own device token', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const deviceTokenValue = 'device-to-remove-123'

    await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: deviceTokenValue, platform: 'web' })

    const res = await request(app)
      .delete(`/api/v1/devices/${deviceTokenValue}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(await DeviceToken.findOne({ token: deviceTokenValue })).toBeNull()
  })

  it('does not allow deregistering another user\'s device token (tenant isolation)', async () => {
    const owner = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const attacker = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const deviceTokenValue = 'owner-only-device-token'

    await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ token: deviceTokenValue, platform: 'ios' })

    const res = await request(app)
      .delete(`/api/v1/devices/${deviceTokenValue}`)
      .set('Authorization', `Bearer ${attacker.token}`)

    expect(res.status).toBe(404)
    // Still there, still owned by the original user.
    const stillThere = await DeviceToken.findOne({ token: deviceTokenValue })
    expect(stillThere).not.toBeNull()
    expect(stillThere?.user.toString()).toBe(owner.authId)
  })

  it('ignores a client-supplied userId/user/authId in the body — always attaches to the authenticated caller (Phase 14 penetration-style check)', async () => {
    const legit = signTestToken({ role: USER_ROLES.EMPLOYEES })
    const victim = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${legit.token}`)
      .send({
        token: 'crafted-request-device-token',
        platform: 'android',
        // A crafted attempt to attach this device to someone else's
        // account. The controller only ever destructures
        // {token, platform, appVersion} from the body (never a user id),
        // so this must have zero effect regardless of what's sent.
        userId: victim.authId,
        user: victim.authId,
        authId: victim.authId,
      })

    expect(res.status).toBe(200)
    const stored = await DeviceToken.findOne({ token: 'crafted-request-device-token' })
    expect(stored?.user.toString()).toBe(legit.authId)
    expect(stored?.user.toString()).not.toBe(victim.authId)
  })

  it('a company/admin user can also register a device (not employee-only)', async () => {
    const { token } = signTestToken({ role: USER_ROLES.COMPANY })

    const res = await request(app)
      .post('/api/v1/devices/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'company-admin-device-token', platform: 'web' })

    expect(res.status).toBe(200)
  })
})
