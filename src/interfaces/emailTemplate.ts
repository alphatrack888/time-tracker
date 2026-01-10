export type ICreateAccount = {
  name: string
  email: string
  otp: string
}

export type IResetPassword = {
  name: string
  email: string
  otp: string
}


export type IEmailOrPhoneVerification = {
  name: string
  email?: string
  phone?: string
  type: 'createAccount' | 'resetPassword'
}


// Subscription email templates
export type ISubscriptionWelcome = {
  name: string
  email: string
  planName: string
  planPrice: number
  planInterval: string
  isTrialing: boolean
  trialDays?: number
  trialEndDate?: Date
  features: string[]
  dashboardUrl: string
}

export type ITrialEnding = {
  name: string
  email: string
  planName: string
  daysLeft: number
  trialEndDate: Date
  planPrice: number
  planInterval: string
  upgradeUrl: string
}

export type IPaymentSuccess = {
  name: string
  email: string
  invoiceNumber: string
  amount: string
  currency: string
  paymentDate: Date
  nextPaymentDate?: Date
  invoiceUrl?: string
  dashboardUrl: string
}

export type IPaymentFailed = {
  name: string
  email: string
  planName: string
  amount: string
  currency: string
  failureReason: string
  retryDate: Date
  updatePaymentUrl: string
  dashboardUrl: string
}

export type IPlanChange = {
  name: string
  email: string
  newPlanName: string
  newPlanPrice: number
  planInterval: string
  isUpgrade: boolean
  priceDifference: number
  prorationNote: string
  features: string[]
  dashboardUrl: string
  billingUrl: string
}

export type ISubscriptionCanceled = {
  name: string
  email: string
  planName: string
  canceledAt: Date
  accessUntil: Date
  reason?: string
  feedbackUrl: string
  reactivateUrl: string
}

