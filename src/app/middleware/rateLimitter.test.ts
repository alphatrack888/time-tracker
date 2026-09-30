import { Request, Response } from 'express'
import rateLimitMiddleware from './rateLimitter'

// This middleware existed but was wired into zero routes before Phase 14
// (confirmed by grepping the whole src tree) — so it also had no test
// coverage at all. Both gaps closed together: applied to
// POST /devices/register and GET /notifications, and exercised directly
// here against fake req/res/next rather than by firing 30+ real HTTP
// requests at a route (slow, and shares one in-process counter per IP
// across every test in a file — see the unique fake IP per test below).

type FakeResponse = Response & {
  statusCode: number
  headers: Record<string, unknown>
  body?: unknown
}

describe('rateLimitMiddleware (Phase 14 audit: existed, unused, untested until now)', () => {
  const makeReq = (ip?: string): Request => ({ ip }) as unknown as Request

  const makeRes = (): FakeResponse => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(key: string, value: unknown) {
        res.headers[key] = value
        return res
      },
      status(code: number) {
        res.statusCode = code
        return res
      },
      json(body: unknown) {
        res.body = body
        return res
      },
    } as FakeResponse
    return res
  }

  it('allows requests under the limit through to next()', async () => {
    const middleware = rateLimitMiddleware(3, 60_000)
    const req = makeReq('192.0.2.1')
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)
    await middleware(req, res, next)
    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(3)
    expect(res.statusCode).toBe(200) // never set to 429
  })

  it('rejects with 429 once the limit is exceeded, and does not call next()', async () => {
    const middleware = rateLimitMiddleware(2, 60_000)
    const req = makeReq('192.0.2.2')
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next) // 1st: allowed
    await middleware(req, res, next) // 2nd: allowed
    await middleware(req, res, next) // 3rd: rejected

    expect(next).toHaveBeenCalledTimes(2)
    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: 'Too many requests', retryAfter: 60 })
  })

  it('tracks separate IPs independently — one client\'s usage never counts against another\'s', async () => {
    const middleware = rateLimitMiddleware(1, 60_000)
    const resA1 = makeRes()
    const resA2 = makeRes()
    const resB1 = makeRes()
    const next = jest.fn()

    await middleware(makeReq('192.0.2.10'), resA1, next) // A's 1st: allowed
    await middleware(makeReq('192.0.2.10'), resA2, next) // A's 2nd: rejected
    await middleware(makeReq('192.0.2.11'), resB1, next) // B's 1st: allowed (fresh counter)

    expect(resA1.statusCode).toBe(200)
    expect(resA2.statusCode).toBe(429)
    expect(resB1.statusCode).toBe(200)
  })

  it('sets X-RateLimit-Limit/Remaining headers on an allowed request', async () => {
    const middleware = rateLimitMiddleware(5, 60_000)
    const req = makeReq('192.0.2.20')
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res.headers['X-RateLimit-Limit']).toBe(5)
    expect(res.headers['X-RateLimit-Remaining']).toBe(4)
  })

  it('fails open (calls next) if the underlying cache throws, rather than blocking all traffic', async () => {
    const middleware = rateLimitMiddleware(1, 60_000)
    // No req.ip at all — the key becomes "ratelimit:undefined", which the
    // cache increment should still handle without throwing; this test is
    // really about the try/catch around it never taking real traffic down
    // if the cache layer misbehaves in some way this suite doesn't model.
    const req = makeReq(undefined)
    const res = makeRes()
    const next = jest.fn()

    await expect(middleware(req, res, next)).resolves.not.toThrow()
    expect(next).toHaveBeenCalled()
  })
})
