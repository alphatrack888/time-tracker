import request from 'supertest'
import app from '../../../app'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { User } from './user.model'

describe('PATCH /user/profile — timezone (Phase 6)', () => {
  it('persists a valid IANA timezone', async () => {
    const company = await User.create({
      name: 'Timezone Co',
      email: `timezone-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: company._id.toString() })

    const res = await request(app)
      .patch('/api/v1/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Asia/Tokyo' })

    expect(res.status).toBe(200)
    const updated = await User.findById(company._id).select('timezone')
    expect(updated?.timezone).toBe('Asia/Tokyo')
  })

  it('rejects a string that is not a real IANA timezone identifier', async () => {
    const { token } = signTestToken({ role: USER_ROLES.COMPANY })

    const res = await request(app)
      .patch('/api/v1/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Not/A_Real_Zone' })

    expect(res.status).toBe(400)
  })
})
