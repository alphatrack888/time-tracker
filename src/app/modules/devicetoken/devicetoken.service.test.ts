import { Types } from 'mongoose'
import { DeviceTokenServices } from './devicetoken.service'
import { DeviceToken } from './devicetoken.model'

describe('DeviceTokenServices data-access helpers (consumed by push sending in Phase 2)', () => {
  it('getTokensForUser returns every token registered to that user, and none for anyone else', async () => {
    const userId = new Types.ObjectId()
    const otherUserId = new Types.ObjectId()

    await DeviceToken.create([
      { user: userId, token: 'user-token-1', platform: 'ios' },
      { user: userId, token: 'user-token-2', platform: 'android' },
      { user: otherUserId, token: 'other-user-token', platform: 'web' },
    ])

    const tokens = await DeviceTokenServices.getTokensForUser(userId)

    expect(tokens.sort()).toEqual(['user-token-1', 'user-token-2'])
  })

  it('getTokensForUser returns an empty array for a user with no registered devices', async () => {
    const tokens = await DeviceTokenServices.getTokensForUser(new Types.ObjectId())
    expect(tokens).toEqual([])
  })

  it('removeStaleToken deletes exactly the given token, leaving others untouched', async () => {
    const userId = new Types.ObjectId()
    await DeviceToken.create([
      { user: userId, token: 'stale-token', platform: 'android' },
      { user: userId, token: 'fresh-token', platform: 'android' },
    ])

    await DeviceTokenServices.removeStaleToken('stale-token')

    expect(await DeviceToken.findOne({ token: 'stale-token' })).toBeNull()
    expect(await DeviceToken.findOne({ token: 'fresh-token' })).not.toBeNull()
  })
})
