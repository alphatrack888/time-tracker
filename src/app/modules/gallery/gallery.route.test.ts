import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../../app'
import { Gallery } from './gallery.model'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES } from '../../../enum/user'

describe('Gallery routes', () => {
  it('GET /api/v1/gallery/ returns employee gallery items', async () => {
    const { authId, token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    await Gallery.create({
      _id: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(authId),
      image: 'https://res.cloudinary.com/demo/image/upload/v1/gallery-a.jpg',
    })
    await Gallery.create({
      _id: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(authId),
      image: 'https://res.cloudinary.com/demo/image/upload/v1/gallery-b.jpg',
    })

    const res = await request(app)
      .get('/api/v1/gallery/')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    expect(res.body.meta).toMatchObject({
      page: 1,
      total: expect.any(Number),
    })
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2)

    for (const item of res.body.data) {
      expect(item).toHaveProperty('_id')
      expect(item).toHaveProperty('image')
      expect(typeof item.image).toBe('string')
    }
  })

  it('GET /api/v1/gallery/ rejects COMPANY role with 403', async () => {
    const { token } = signTestToken({ role: USER_ROLES.COMPANY })

    const res = await request(app)
      .get('/api/v1/gallery/')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })
})
