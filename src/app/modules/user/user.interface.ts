import { Model, Types } from 'mongoose'

type IAuthentication = {
  restrictionLeftAt: Date | null
  resetPassword: boolean
  wrongLoginAttempts: number
  passwordChangedAt?: Date
  oneTimeCode: string
  latestRequestAt: Date
  expiresAt?: Date
  requestCount?: number
  authType?: 'createAccount' | 'resetPassword'
}


export type Point = {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
}

export type IUser = {
  _id: Types.ObjectId
  name?: string
  email?: string
  profile?: string
  phone?: string
  status: string
  verified: boolean
  address?: string
  designation?: string
  company?: Types.ObjectId

  location: Point
  password: string
  role: string
  appId?: string
  /**
   * @deprecated Single-token, overwritten-on-login field — superseded by
   * the multi-device `DeviceToken` collection (see devicetoken module,
   * integration plan Phase 1). No longer written to as of that phase;
   * kept readable only in case anything historical still reads it.
   */
  deviceToken?: string
  /**
   * Preferred language for notification content (and, per the existing
   * report-generation precedent, PDF reports). Falls back to 'en' wherever
   * unset or an unsupported value somehow ends up here.
   */
  language?: 'en' | 'de'
  /**
   * IANA timezone identifier (e.g. 'America/New_York'), meaningful mainly
   * on COMPANY-role users — used by the daily overtime sweep (Phase 6) to
   * determine that company's local calendar-day boundaries. Falls back to
   * UTC wherever unset.
   */
  timezone?: string
  manualBreak?:boolean
  // Subscription-related fields
  stripeCustomerId?: string
  subscriptionStatus?: string
  subscriptionTier?: string
  trialUsed?: boolean
  subscriptionExpiresAt?: Date

  authentication: IAuthentication
  createdAt: Date
  updatedAt: Date
}

export type UserModel = {
  isPasswordMatched: (
    givenPassword: string,
    savedPassword: string,
  ) => Promise<boolean>
} & Model<IUser>


export type IUserFilter = {
 searchTerm?:string,
 role?:string,
 status?:string,
 latitude?:number,
 longitude?:number,
 fromLat?:number,
 toLat?:number,
 fromLong?:number,
 toLong?:number,
 distance?:number,
 state?:string,

}