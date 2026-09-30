import { Types } from 'mongoose'
import { Notification } from '../app/modules/notifications/notifications.model'
// Registers the 'User' model so `.populate('from', ...)` in
// sendNotificationsToUser can resolve the ref (side-effect import only).
import '../app/modules/user/user.model'
import type { SocketWithUser, socketHelper as SocketHelperType } from './socketHelper'

// `socketHelper.ts` imports `onlineUsers` from `../server`, and `server.ts`
// calls `main()` (real mongo connect + real `app.listen`) at module scope.
// Mock `../server` *before* requiring socketHelper so that side effect never
// runs in the test process. `jest.doMock` (imperative, not hoisted) plus a
// lazy `require` guarantees the mock is registered before socketHelper's
// own `require('../server')` executes — unlike `jest.mock`, this doesn't
// depend on ts-jest's hoisting behavior relative to `import` statements.
let socketHelper: typeof SocketHelperType

beforeAll(() => {
  jest.doMock('../server', () => ({ onlineUsers: new Map() }))
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  socketHelper = require('./socketHelper').socketHelper
})

describe('socketHelper.sendNotificationsToUser (Phase 0 fix: to/from, not receiver/sender)', () => {
  it('finds notifications addressed to the connecting user and reports the correct unread count', async () => {
    const userId = new Types.ObjectId()
    const otherUserId = new Types.ObjectId()

    await Notification.create([
      { to: userId, from: otherUserId, title: 'Read', body: 'r', isRead: true },
      { to: userId, from: otherUserId, title: 'Unread 1', body: 'u1', isRead: false },
      { to: userId, from: otherUserId, title: 'Unread 2', body: 'u2', isRead: false },
      // Notification for a *different* user must never be returned here.
      { to: otherUserId, from: userId, title: 'Not mine', body: 'x', isRead: false },
    ])

    const emit = jest.fn()
    const fakeSocket = {
      user: { authId: userId.toString(), role: 'employee' },
      emit,
    } as unknown as SocketWithUser

    await socketHelper.sendNotificationsToUser(fakeSocket)

    expect(emit).toHaveBeenCalledTimes(1)
    const [eventName, payload] = emit.mock.calls[0]
    expect(eventName).toBe(`notifications::${userId.toString()}`)
    expect(payload.notifications).toHaveLength(3)
    expect(payload.unreadCount).toBe(2)
  })

  it('does nothing (no throw) when the socket has no authenticated user', async () => {
    const emit = jest.fn()
    const fakeSocket = { user: undefined, emit } as unknown as SocketWithUser

    await expect(socketHelper.sendNotificationsToUser(fakeSocket)).resolves.not.toThrow()
    expect(emit).not.toHaveBeenCalled()
  })
})
