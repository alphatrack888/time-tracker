import { JwtPayload } from 'jsonwebtoken'

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging with Express's own Request type requires `interface`; `type` cannot merge here.
    interface Request {
      user: JwtPayload
    }
  }
}
