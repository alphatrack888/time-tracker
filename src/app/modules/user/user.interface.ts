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
  deviceToken?: string
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