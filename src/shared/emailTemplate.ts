import { ICreateAccount, IPaymentFailed, IPaymentSuccess, IPlanChange, IResetPassword, ISubscriptionCanceled, ISubscriptionWelcome, ITrialEnding } from '../interfaces/emailTemplate'

const brandColor = '#3b7caa'
const logoUrl = 'https://company.alphatrack.app/assets/logIn-BVvWdvG-.png'

const baseLayout = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; color: #1a1a1a; }
    .container { max-width: 600px; margin: 40px auto; padding: 40px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-top: 4px solid ${brandColor}; }
    .content { line-height: 1.6; font-size: 16px; color: #333333; }
    .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #edf2f7; color: #64748b; font-size: 13px; text-align: center; }
    .button { display: block; width: fit-content; padding: 14px 28px; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px auto; text-align: center; }
    .otp-code { font-size: 36px; font-weight: 700; color: ${brandColor}; letter-spacing: 6px; margin: 24px 0; padding: 16px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; display: block; text-align: center; background-color: #f8fafc; }
    .details { background-color: #f8fafc; padding: 24px; border-radius: 6px; margin: 24px 0; border: 1px solid #edf2f7; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 24px; color: #0f172a; text-align: center; }
    h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1e293b; }
    p { margin-bottom: 18px; }
    .highlight { color: ${brandColor}; font-weight: 600; }
    ul { padding-left: 20px; margin: 0 0 18px 0; }
    li { margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
        <div class="header" style="text-align: center; margin-bottom: 32px;">
          <img src="${logoUrl}" alt="AlphaTrack" style="height: 64px; width: auto; display: block; margin: 0 auto;">
        </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin-bottom: 8px;">&copy; ${new Date().getFullYear()} AlphaTrack. All rights reserved.</p>
      <p style="margin: 0;">AlphaTrack Team</p>
    </div>
  </div>
</body>
</html>
`

const createAccount = (values: ICreateAccount) => {
  const data = {
    to: values.email,
    subject: `Verify your account, ${values.name}`,
    html: baseLayout(`
      <h1>Verify your account</h1>
      <p>Hello ${values.name},</p>
      <p>To complete your registration for <span class="highlight">AlphaTrack</span>, please use the verification code below:</p>
      <div class="otp-code">${values.otp}</div>
      <p>This code will expire in 5 minutes. If you didn't request this code, you can safely ignore this email.</p>
    `, 'Verify your account'),
  }
  return data
}

const sendUserCredentials = (values: { email: string; name: string; password: string }) => {
  const data = {
    to: values.email,
    subject: `Welcome to AlphaTrack, ${values.name}`,
    html: baseLayout(`
      <h1>Welcome, ${values.name}</h1>
      <p>Your account has been created successfully. You can now log in using the credentials below:</p>
      <div class="details">
        <p style="margin: 0;"><strong>Email:</strong> ${values.email}</p>
        <p style="margin: 0;"><strong>Password:</strong> ${values.password}</p>
      </div>
      <a href="https://alphatrack.app/login" class="button">Log In</a>
      <p>Please change your password after your first login for security.</p>
    `, 'Welcome to AlphaTrack'),
  }
  return data
}


const resetPassword = (values: IResetPassword) => {
  const data = {
    to: values.email,
    subject: `Reset your password, ${values.name}`,
    html: baseLayout(`
      <h1>Reset your password</h1>
      <p>Hello ${values.name},</p>
      <p>We received a request to reset your password. Use the following code to proceed:</p>
      <div class="otp-code">${values.otp}</div>
      <p>This code will expire in 5 minutes. If you didn't request a reset, you can safely ignore this email.</p>
    `, 'Password Reset'),
  }
  return data
}

const resendOtp = (values: {
  email: string
  name: string
  otp: string
  type: 'resetPassword' | 'createAccount'
}) => {
  const isReset = values.type === 'resetPassword'
  const data = {
    to: values.email,
    subject: `${isReset ? 'Password Reset' : 'Account Verification'} - New Code`,
    html: baseLayout(`
      <h1>New Verification Code</h1>
      <p>Hello ${values.name},</p>
      <p>You requested a new code for your account. Here is your new code:</p>
      <div class="otp-code">${values.otp}</div>
      <p>This code will expire in 5 minutes. Please do not share it with anyone.</p>
    `, 'New Verification Code'),
  }
  return data
}

// Subscription Welcome Email
const subscriptionWelcome = (values: ISubscriptionWelcome) => {
  const data = {
    to: values.email,
    subject: values.isTrialing ? `Welcome to your ${values.planName} trial!` : `Welcome to ${values.planName}!`,
    html: baseLayout(`
      <h1>Welcome to ${values.planName}</h1>
      <p>Hello ${values.name},</p>
      <p>${
        values.isTrialing
          ? `Your ${values.trialDays}-day free trial is now active. You have access to all features until ${values.trialEndDate?.toLocaleDateString()}.`
          : `Thank you for subscribing! Your account is now active.`
      }</p>
      
      <div class="details">
        <p style="margin: 0;"><strong>Plan:</strong> ${values.planName}</p>
        <p style="margin: 0;"><strong>Price:</strong> $${values.planPrice}/${values.planInterval}</p>
        ${
          values.isTrialing
            ? `<p style="margin: 0;"><strong>Trial Ends:</strong> ${values.trialEndDate?.toLocaleDateString()}</p>`
            : ''
        }
      </div>

      <h2>Included Features:</h2>
      <ul>
        ${values.features.map((feature) => `<li>${feature}</li>`).join('')}
      </ul>

      <a href="${values.dashboardUrl}" class="button">Go to Dashboard</a>
    `, 'Welcome to AlphaTrack'),
  }
  return data
}

const trialEnding = (values: ITrialEnding) => {
  const data = {
    to: values.email,
    subject: `Your ${values.planName} trial ends in ${values.daysLeft} days`,
    html: baseLayout(`
      <h1>Your trial is ending</h1>
      <p>Hello ${values.name},</p>
      <p>Your trial of ${values.planName} will end in ${values.daysLeft} days on ${values.trialEndDate.toLocaleDateString()}.</p>
      
      <div class="details">
        <p style="margin: 0;">Continue your subscription for <strong>$${values.planPrice}/${values.planInterval}</strong>.</p>
      </div>

      <a href="${values.upgradeUrl}" class="button">Keep My Plan</a>
      <p>If you don't take action, you'll lose access to premium features after your trial ends.</p>
    `, 'Trial Ending Soon'),
  }
  return data
}

// Payment Success Email
const paymentSuccess = (values: IPaymentSuccess) => {
  const data = {
    to: values.email,
    subject: 'Payment Successful - AlphaTrack Receipt',
    html: baseLayout(`
      <h1>Payment Successful</h1>
      <p>Hello ${values.name},</p>
      <p>We've successfully processed your payment. Thank you for using AlphaTrack.</p>
      
      <div class="details">
        <p style="margin: 0;"><strong>Invoice:</strong> ${values.invoiceNumber}</p>
        <p style="margin: 0;"><strong>Amount:</strong> ${values.amount} ${values.currency.toUpperCase()}</p>
        <p style="margin: 0;"><strong>Date:</strong> ${values.paymentDate.toLocaleDateString()}</p>
      </div>

      <a href="${values.dashboardUrl}" class="button">Go to Dashboard</a>
      ${values.invoiceUrl ? `<p><a href="${values.invoiceUrl}">Download Receipt</a></p>` : ''}
    `, 'Payment Successful'),
  }
  return data
}

// Payment Failed Email
const paymentFailed = (values: IPaymentFailed) => {
  const data = {
    to: values.email,
    subject: 'Payment Failed - Action Required',
    html: baseLayout(`
      <h1>Payment Failed</h1>
      <p>Hello ${values.name},</p>
      <p>We were unable to process your payment for ${values.planName}. Please update your payment method to avoid service interruption.</p>
      
      <div class="details" style="border-left: 4px solid #ef4444;">
        <p style="margin: 0;"><strong>Amount:</strong> ${values.amount} ${values.currency.toUpperCase()}</p>
        <p style="margin: 0;"><strong>Reason:</strong> ${values.failureReason}</p>
      </div>

      <a href="${values.updatePaymentUrl}" class="button">Update Payment Method</a>
      <p>We will attempt the payment again on ${values.retryDate.toLocaleDateString()}.</p>
    `, 'Payment Failed'),
  }
  return data
}

// Plan Change Email
const planChange = (values: IPlanChange) => {
  const data = {
    to: values.email,
    subject: `Plan ${values.isUpgrade ? 'Upgraded' : 'Changed'} - ${values.newPlanName}`,
    html: baseLayout(`
      <h1>Plan Changed</h1>
      <p>Hello ${values.name},</p>
      <p>Your subscription has been successfully ${values.isUpgrade ? 'upgraded' : 'changed'} to <strong>${values.newPlanName}</strong>.</p>
      
      <div class="details">
        <p style="margin: 0;"><strong>New Plan:</strong> ${values.newPlanName}</p>
        <p style="margin: 0;"><strong>Price:</strong> $${values.newPlanPrice}/${values.planInterval}</p>
      </div>

      <p>${values.prorationNote}</p>
      <a href="${values.dashboardUrl}" class="button">Go to Dashboard</a>
    `, 'Plan Changed'),
  }
  return data
}

// Subscription Canceled Email
const subscriptionCanceled = (values: ISubscriptionCanceled) => {
  const data = {
    to: values.email,
    subject: 'Subscription Canceled',
    html: baseLayout(`
      <h1>Subscription Canceled</h1>
      <p>Hello ${values.name},</p>
      <p>Your subscription has been canceled. You will continue to have access to premium features until <strong>${values.accessUntil.toLocaleDateString()}</strong>.</p>
      
      <div class="details">
        <p style="margin: 0;"><strong>Access Until:</strong> ${values.accessUntil.toLocaleDateString()}</p>
      </div>

      <p>Changed your mind? You can reactivate your subscription anytime before your access ends.</p>
      <a href="${values.reactivateUrl}" class="button">Reactivate Subscription</a>
    `, 'Subscription Canceled'),
  }
  return data
}

export const emailTemplate = {
  createAccount,
  resetPassword,
  resendOtp,
  sendUserCredentials,
  subscriptionWelcome,
  paymentSuccess,
  paymentFailed,
  subscriptionCanceled,
  planChange,
  trialEnding,

}
