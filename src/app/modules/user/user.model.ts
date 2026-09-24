import { Schema, model } from 'mongoose'
import { IUser, UserModel } from './user.interface'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import ApiError from '../../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'
import config from '../../../config'
import bcrypt from 'bcrypt'

const userSchema = new Schema<IUser, UserModel>(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      trim:true,
    },
    phone: {
      type: String,
    },
    company:{
      type:Schema.Types.ObjectId,
      ref:"User",
      populate:{
        path:'User',
        select:{name:1, profile:1, email:1, phone:1,address:1}
      }
    },
    status: {
      type: String,
      enum: [USER_STATUS.ACTIVE, USER_STATUS.RESTRICTED, USER_STATUS.DELETED],
      default: USER_STATUS.ACTIVE,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    profile: {
      type: String,
      default:""
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      default: USER_ROLES.EMPLOYEES,
    },
    address: {
      type: String,
    },
    location: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        default: [0.0, 0.0], // [longitude, latitude]
      },
    },
    appId: {
      type: String,
    },
    designation: {
      type: String,
    },
    // @deprecated — superseded by the DeviceToken collection (multi-device).
    // No longer written to; kept only so a legacy value already stored for
    // a pre-migration user doesn't hard-fail a read. `select: false` (Phase
    // 14 audit) because nothing legitimately needs it back in a response,
    // and without this it leaked through every endpoint that returns a
    // full User document — including `getSingleUser`/`generalGetAllUsers`,
    // where an admin or company viewing someone else's profile would see
    // a stale FCM/APNs token that has nothing to do with them requesting
    // that profile. Same pattern already used for `password` just above.
    deviceToken: {
      type: String,
      select: false,
    },
    language: {
      type: String,
      enum: ['en', 'de'],
    },
    // IANA timezone identifier — see user.interface.ts for how this is used.
    timezone: {
      type: String,
    },
    // Subscription-related fields
    stripeCustomerId: {
      type: String,
      default: null,
    },
    subscriptionStatus: {
      type: String,
      enum: [
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused',
      ],
      default: null,
    },
    subscriptionTier: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: null,
    },
    trialUsed: {
      type: Boolean,
      default: false,
    },
    manualBreak: {
      type: Boolean,
      default: false,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    authentication: {
      _id: false,
      select: false,
      type: {
        restrictionLeftAt: {
          type: Date,
          default: null,
        },
        resetPassword: {
          type: Boolean,
          default: false,
        },
        wrongLoginAttempts: {
          type: Number,
          default: 0,
        },
        passwordChangedAt: {
          type: Date,
          default: null,
        },
        oneTimeCode: {
          type: String,
          default: null,
        },
        latestRequestAt: {
          type: Date,
          default: null,
        },
        expiresAt: {
          type: Date,
          default: null,
        },
        requestCount: {
          type: Number,
          default: 0,
        },
        authType: {
          type: String,
          default: null,
        },
      },
    },
  },
  {
    timestamps: true,
  },
)

userSchema.index({ location: '2dsphere' })

// Subscription-related indexes
userSchema.index({ stripeCustomerId: 1 })
userSchema.index({ subscriptionStatus: 1 })
userSchema.index({ subscriptionExpiresAt: 1 })
userSchema.index({ role: 1, subscriptionStatus: 1 }) // Compound index for role-based subscription queries

userSchema.statics.isPasswordMatched = async function (
  givenPassword: string,
  savedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(givenPassword, savedPassword)
}

userSchema.pre<IUser>('save', async function (next) {
  //find the user by email
  const isExist = await User.findOne({
    email: this.email,
    status: { $in: [USER_STATUS.ACTIVE, USER_STATUS.RESTRICTED] },
  })
  if (isExist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'An account with this email already exists',
    )
  }

  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcrypt_salt_rounds),
  )
  next()
})

export const User = model<IUser, UserModel>('User', userSchema)
