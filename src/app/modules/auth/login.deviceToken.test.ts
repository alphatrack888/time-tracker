import request from 'supertest'
import app from '../../../app'
import { User } from '../user/user.model'
import { DeviceToken } from '../devicetoken/devicetoken.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

describe('Login (Phase 1: deviceToken now goes to DeviceToken collection, not User.deviceToken)', () => {
  const email = 'login-device-token@example.com'
  const password = 'Password123!'

  beforeEach(async () => {
    await User.create({
      name: 'Login Test User',
      email,
      password,
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
      // Pre-existing, unrelated bug: `handleLoginLogic` (common.ts:19)
      // destructures `isUserExist.authentication` unconditionally, but
      // `authentication` isn't reliably populated with its schema defaults
      // for a user created without it explicitly set, causing a 500 on
      // first login. Set explicitly here so this Phase 1 test exercises
      // only what it's meant to (device token handling), not that gap.
      authentication: {
        restrictionLeftAt: null,
        resetPassword: false,
        wrongLoginAttempts: 0,
      },
    })
  })

  it('registers the submitted deviceToken into the DeviceToken collection and leaves User.deviceToken unset', async () => {
    const res = await request(app)
      .post('/api/v1/auth/custom-login')
      .send({ email, password, deviceToken: 'login-time-fcm-token' })

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeDefined()

    const user = await User.findOne({ email }).select('+deviceToken')
    expect(user?.deviceToken).toBeUndefined()

    const deviceRow = await DeviceToken.findOne({ token: 'login-time-fcm-token' })
    expect(deviceRow).not.toBeNull()
    expect(deviceRow?.user.toString()).toBe(user?._id.toString())
  })

  it('logs in successfully even without a deviceToken in the payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/custom-login')
      .send({ email, password })

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeDefined()
  })
})
