import { JwtPayload } from 'jsonwebtoken'
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

// Phase 16 QA matrix row: "User uninstalls and reinstalls the app." A
// reinstall gets a brand-new FCM token (a different string), not the old
// one back — registerDeviceToken upserts keyed on `token` (unique index),
// so there's no way for it to know the old token belongs to the same
// physical device/install. These tests lock in the actual, correct
// consequence of that: the old row is never proactively deleted at
// registration time (nothing here proactively could, without risking a
// device that's still genuinely in use), it only ever goes away later via
// the existing FCM-error-driven removeStaleToken path (already covered by
// notificationHelper.test.ts's "removes device tokens FCM reports as
// invalid" case) — so a string of reinstalls leaves one row per distinct
// token ever seen, not a single row that's silently overwritten or lost.
describe('DeviceTokenServices.registerDeviceToken — uninstall/reinstall (Phase 16)', () => {
  it('keeps the old token registered (not deleted) when a reinstall registers a new one for the same user', async () => {
    const user = { authId: new Types.ObjectId().toString() } as JwtPayload

    await DeviceTokenServices.registerDeviceToken(user, { token: 'pre-reinstall-token', platform: 'ios' })
    await DeviceTokenServices.registerDeviceToken(user, { token: 'post-reinstall-token', platform: 'ios' })

    const tokens = (await DeviceTokenServices.getTokensForUser(user.authId as string)).sort()
    expect(tokens).toEqual(['post-reinstall-token', 'pre-reinstall-token'])
  })

  it('does not create a duplicate row when the same token is registered again (app reopened, no new FCM token issued)', async () => {
    const user = { authId: new Types.ObjectId().toString() } as JwtPayload

    await DeviceTokenServices.registerDeviceToken(user, { token: 'stable-token', platform: 'android' })
    await DeviceTokenServices.registerDeviceToken(user, { token: 'stable-token', platform: 'android', appVersion: '2.0.0' })

    const rows = await DeviceToken.find({ user: user.authId })
    expect(rows).toHaveLength(1)
    expect(rows[0].appVersion).toBe('2.0.0')
  })

  it('a full uninstall/reinstall cycle ends with exactly the new token once the old one is reported stale by FCM', async () => {
    const user = { authId: new Types.ObjectId().toString() } as JwtPayload

    await DeviceTokenServices.registerDeviceToken(user, { token: 'old-install-token', platform: 'ios' })
    await DeviceTokenServices.registerDeviceToken(user, { token: 'new-install-token', platform: 'ios' })

    // The next push attempt is what would actually discover the old token
    // is dead (FCM's own error response) — simulated directly here since
    // that FCM round trip itself is covered elsewhere.
    await DeviceTokenServices.removeStaleToken('old-install-token')

    const tokens = await DeviceTokenServices.getTokensForUser(user.authId as string)
    expect(tokens).toEqual(['new-install-token'])
  })
})
