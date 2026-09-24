import jwt from 'jsonwebtoken'
import { Types } from 'mongoose'

/**
 * Signs a JWT matching the shape `auth.helper.ts#createToken` produces, for
 * use as an `Authorization: Bearer <token>` header in integration tests.
 */
export const signTestToken = (opts: {
  authId?: string
  role: string
  name?: string
  email?: string
  company?: string
}) => {
  const authId = opts.authId || new Types.ObjectId().toString()
  return {
    authId,
    token: jwt.sign(
      {
        authId,
        role: opts.role,
        name: opts.name,
        email: opts.email,
        company: opts.company,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' },
    ),
  }
}
