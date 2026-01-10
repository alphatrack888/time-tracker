import { ICreateAccount, IPaymentFailed, IPaymentSuccess, IPlanChange, IResetPassword, ISubscriptionCanceled, ISubscriptionWelcome, ITrialEnding } from '../interfaces/emailTemplate'

const createAccount = (values: ICreateAccount) => {

  const data = {
    to: values.email,
    subject: `Verify your account, ${values.name}`,
    html: `
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">Email Verification</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">Your verification code is:</p>
            <div style="background-color: #f0f0f0; border-radius: 4px; padding: 15px; margin: 20px 0; text-align: center;">
              <span style="font-size: 32px; font-weight: bold; color: #4a4a4a;">${values.otp}</span>
            </div>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">This code will expire in 5 minutes. If you didn't request this code, please ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px;">
            <p>&copy; 2024 Your Company. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
  `,
  }
  return data
}

const sendUserCredentials = (values: {email: string, name: string, password: string}) => {

  const data = {
    to: values.email,
    subject: `Welcome to Your Time Tracker, ${values.name}`,
    html: `
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">Welcome, ${values.name}!</h1>
              <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                Your account has been created successfully. Below are your login credentials:
              </p>
              <div style="background-color: #f0f0f0; border-radius: 4px; padding: 15px; margin: 20px 0;">
                <p style="font-size: 16px; color: #4a4a4a;"><strong>Email:</strong> ${values.email}</p>
                <p style="font-size: 16px; color: #4a4a4a;"><strong>Password:</strong> ${values.password}</p>
              </div>
              <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                Please keep this information safe and do not share it with anyone.
              </p>
              <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                You can now log in to your account and start using our services.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px;">
              <p>&copy; 2024 Your Company. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </body>
    `,
  }
  return data
}


const resetPassword = (values: IResetPassword) => {
  const data = {
    to: values.email,
    subject: `Reset your password, ${values.name}`,
    html: `
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">Password Reset</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">Your password reset code is:</p>
            <div style="background-color: #f0f0f0; border-radius: 4px; padding: 15px; margin: 20px 0; text-align: center;">
              <span style="font-size: 32px; font-weight: bold; color: #4a4a4a;">${values.otp}</span>
            </div>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">This code will expire in 5 minutes. If you didn't request this code, please ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px;">
            <p>&copy; 2024 Your Company. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
  `,
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
    html: `
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">New Verification Code</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">
              Hello ${values.name},<br><br>
              You requested a new ${isReset ? 'password reset' : 'verification'} code. Here's your new code:
            </p>
            <div style="background-color: #f0f0f0; border-radius: 4px; padding: 15px; margin: 20px 0; text-align: center;">
              <span style="font-size: 32px; font-weight: bold; color: #4a4a4a;">${values.otp}</span>
            </div>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">
              This code will expire in 5 minutes.<br>
              If you didn't request this code, please ignore this email or contact support.
            </p>
            <div style="margin-top: 30px; padding: 15px; background-color: #fff8e1; border-radius: 4px; border-left: 4px solid #ffd54f;">
              <p style="color: #666666; font-size: 14px; margin: 0;">
                For security reasons, never share this code with anyone.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px; border-top: 1px solid #eeeeee;">
            <p>&copy; 2024 Your Company. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
  `,
  }
  return data
}

// Subscription Welcome Email
const subscriptionWelcome = (values: ISubscriptionWelcome) => {
  const data = {
    to: values.email,
    subject: values.isTrialing 
      ? `Welcome to your ${values.planName} trial!` 
      : `Welcome to ${values.planName}!`,
    html: `
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">
              ${values.isTrialing ? `🎉 Your ${values.planName} Trial Starts Now!` : `🎉 Welcome to ${values.planName}!`}
            </h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">
              Hello ${values.name},<br><br>
              ${values.isTrialing 
                ? `Your ${values.trialDays}-day free trial of ${values.planName} is now active! You have full access to all premium features until ${values.trialEndDate?.toLocaleDateString()}.`
                : `Thank you for subscribing to ${values.planName}! Your subscription is now active.`
              }
            </p>
            
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333333; margin-top: 0;">Plan Details:</h3>
              <p style="color: #666666; margin: 5px 0;"><strong>Plan:</strong> ${values.planName}</p>
              <p style="color: #666666; margin: 5px 0;"><strong>Price:</strong> $${values.planPrice}/${values.planInterval}</p>
              ${values.isTrialing ? `<p style="color: #666666; margin: 5px 0;"><strong>Trial Ends:</strong> ${values.trialEndDate?.toLocaleDateString()}</p>` : ''}
            </div>

            <div style="background-color: #e8f5e8; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333333; margin-top: 0;">✨ What's Included:</h3>
              <ul style="color: #666666; padding-left: 20px;">
                ${values.features.map(feature => `<li style="margin: 5px 0;">${feature}</li>`).join('')}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${values.dashboardUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>

            ${values.isTrialing ? `
            <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border-radius: 4px; border-left: 4px solid #ffc107;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>Trial Reminder:</strong> Your trial will automatically convert to a paid subscription unless you cancel before ${values.trialEndDate?.toLocaleDateString()}.
              </p>
            </div>
            ` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px; border-top: 1px solid #eeeeee;">
            <p>Need help? Contact our support team anytime.</p>
            <p>&copy; 2024 FleetSync. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    `,
  }
  return data
}

// Trial Ending Email
const trialEnding = (values: ITrialEnding) => {
  const data = {
    to: values.email,
    subject: `Your ${values.planName} trial ends in ${values.daysLeft} days`,
    html: `
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">⏰ Your Trial is Ending Soon</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">
              Hello ${values.name},<br><br>
              Your ${values.planName} trial ends in <strong>${values.daysLeft} days</strong> on ${values.trialEndDate.toLocaleDateString()}.
            </p>
            
            <div style="background-color: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">Don't lose access to your premium features!</h3>
              <p style="color: #856404; margin: 5px 0;">Continue with ${values.planName} for just $${values.planPrice}/${values.planInterval}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${values.upgradeUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">
                Continue Subscription
              </a>
            </div>

            <p style="color: #666666; font-size: 14px; line-height: 1.5; text-align: center;">
              If you don't take action, your trial will end and you'll lose access to premium features.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px; border-top: 1px solid #eeeeee;">
            <p>&copy; 2024 FleetSync. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    `,
  }
  return data
}

// Payment Success Email
const paymentSuccess = (values: IPaymentSuccess) => {
  const data = {
    to: values.email,
    subject: 'Payment Successful - Invoice Receipt',
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Payment Successful</title>
      <style>
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            margin: 10px auto !important;
          }
          .email-content {
            padding: 15px 20px !important;
          }
          .email-header {
            padding: 20px 0 !important;
          }
          .email-footer {
            padding: 15px 20px !important;
          }
          .button-container {
            display: block !important;
          }
          .email-button {
            display: block !important;
            width: 100% !important;
            margin: 10px 0 !important;
            padding: 15px 20px !important;
            text-align: center !important;
          }
          .details-box {
            padding: 15px !important;
            margin: 15px 0 !important;
          }
          h1 {
            font-size: 20px !important;
          }
          .logo {
            width: 120px !important;
          }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);" class="email-container">
        <tr>
          <td align="center" style="padding: 40px 0;" class="email-header">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto; max-width: 100%;" class="logo">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;" class="email-content">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px; text-align: center;">✅ Payment Successful</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Hello ${values.name},<br><br>
              Your payment has been processed successfully. Here are your payment details:
            </p>
            
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;" class="details-box">
              <h3 style="color: #333333; margin-top: 0; margin-bottom: 15px;">Payment Details:</h3>
              <p style="color: #666666; margin: 8px 0; word-break: break-word;"><strong>Invoice:</strong> ${values.invoiceNumber}</p>
              <p style="color: #666666; margin: 8px 0;"><strong>Amount:</strong> ${values.amount} ${values.currency.toUpperCase()}</p>
              <p style="color: #666666; margin: 8px 0;"><strong>Payment Date:</strong> ${values.paymentDate.toLocaleDateString()}</p>
              ${values.nextPaymentDate ? `<p style="color: #666666; margin: 8px 0;"><strong>Next Payment:</strong> ${values.nextPaymentDate.toLocaleDateString()}</p>` : ''}
            </div>

            <div style="text-align: center; margin: 30px 0;" class="button-container">
              ${values.invoiceUrl ? `
              <a href="${values.invoiceUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px; display: inline-block; min-width: 120px;" class="email-button">
                View Invoice
              </a>
              ` : ''}
              <a href="${values.dashboardUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; min-width: 120px;" class="email-button">
                Go to Dashboard
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px; border-top: 1px solid #eeeeee;" class="email-footer">
            <p style="margin: 5px 0;">Thank you for your business!</p>
            <p style="margin: 5px 0;">&copy; 2024 FleetSync. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `,
  }
  return data
}

// Payment Failed Email
const paymentFailed = (values: IPaymentFailed) => {
  const data = {
    to: values.email,
    subject: 'Payment Failed - Action Required',
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Payment Failed</title>
      <style>
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            margin: 10px auto !important;
          }
          .email-content {
            padding: 15px 20px !important;
          }
          .email-header {
            padding: 20px 0 !important;
          }
          .email-footer {
            padding: 15px 20px !important;
          }
          .button-container {
            display: block !important;
          }
          .email-button {
            display: block !important;
            width: 100% !important;
            margin: 10px 0 !important;
            padding: 15px 20px !important;
            text-align: center !important;
          }
          .details-box {
            padding: 15px !important;
            margin: 15px 0 !important;
          }
          .warning-box {
            padding: 12px !important;
            margin: 20px 0 !important;
          }
          h1 {
            font-size: 20px !important;
          }
          .logo {
            width: 120px !important;
          }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);" class="email-container">
        <tr>
          <td align="center" style="padding: 40px 0;" class="email-header">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto; max-width: 100%;" class="logo">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;" class="email-content">
            <h1 style="color: #dc3545; font-size: 24px; margin-bottom: 20px; text-align: center;">❌ Payment Failed</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Hello ${values.name},<br><br>
              We were unable to process your payment for ${values.planName}. Please update your payment method to continue your subscription.
            </p>
            
            <div style="background-color: #f8d7da; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc3545;" class="details-box">
              <h3 style="color: #721c24; margin-top: 0; margin-bottom: 15px;">Payment Details:</h3>
              <p style="color: #721c24; margin: 8px 0;"><strong>Amount:</strong> ${values.amount} ${values.currency.toUpperCase()}</p>
              <p style="color: #721c24; margin: 8px 0; word-break: break-word;"><strong>Reason:</strong> ${values.failureReason}</p>
              <p style="color: #721c24; margin: 8px 0;"><strong>Next Retry:</strong> ${values.retryDate.toLocaleDateString()}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;" class="button-container">
              <a href="${values.updatePaymentUrl}" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px; display: inline-block; min-width: 120px;" class="email-button">
                Update Payment Method
              </a>
              <a href="${values.dashboardUrl}" style="background-color: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; min-width: 120px;" class="email-button">
                Go to Dashboard
              </a>
            </div>

            <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border-radius: 4px; border-left: 4px solid #ffc107;" class="warning-box">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>Important:</strong> If payment continues to fail, your subscription may be suspended.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px; border-top: 1px solid #eeeeee;" class="email-footer">
            <p style="margin: 5px 0;">Need help? Contact our support team.</p>
            <p style="margin: 5px 0;">&copy; 2024 FleetSync. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `,
  }
  return data
}

// Plan Change Email
const planChange = (values: IPlanChange) => {
  const data = {
    to: values.email,
    subject: `Plan ${values.isUpgrade ? 'Upgraded' : 'Changed'} - ${values.newPlanName}`,
    html: `
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">
              ${values.isUpgrade ? '🚀 Plan Upgraded!' : '📝 Plan Changed!'}
            </h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">
              Hello ${values.name},<br><br>
              Your subscription has been successfully ${values.isUpgrade ? 'upgraded' : 'changed'} to ${values.newPlanName}!
            </p>
            
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333333; margin-top: 0;">New Plan Details:</h3>
              <p style="color: #666666; margin: 5px 0;"><strong>Plan:</strong> ${values.newPlanName}</p>
              <p style="color: #666666; margin: 5px 0;"><strong>Price:</strong> $${values.newPlanPrice}/${values.planInterval}</p>
            </div>

            <div style="background-color: ${values.isUpgrade ? '#e8f5e8' : '#e3f2fd'}; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333333; margin-top: 0;">Billing Information:</h3>
              <p style="color: #666666; margin: 5px 0;">${values.prorationNote}</p>
            </div>

            <div style="background-color: #f0f8ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333333; margin-top: 0;">✨ Your New Features:</h3>
              <ul style="color: #666666; padding-left: 20px;">
                ${values.features.map(feature => `<li style="margin: 5px 0;">${feature}</li>`).join('')}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${values.dashboardUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">
                Go to Dashboard
              </a>
              <a href="${values.billingUrl}" style="background-color: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Billing
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px; border-top: 1px solid #eeeeee;">
            <p>Thank you for choosing FleetSync!</p>
            <p>&copy; 2024 FleetSync. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    `,
  }
  return data
}

// Subscription Canceled Email
const subscriptionCanceled = (values: ISubscriptionCanceled) => {
  const data = {
    to: values.email,
    subject: 'Subscription Canceled - We\'re Sorry to See You Go',
    html: `
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <img src="https://res.cloudinary.com/dmvht7o8m/image/upload/v1737711309/download_bjkj2g.png" alt="Logo" style="width: 150px; height: auto;">
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px;">
            <h1 style="color: #333333; font-size: 24px; margin-bottom: 20px;">😔 Subscription Canceled</h1>
            <p style="color: #666666; font-size: 16px; line-height: 1.5;">
              Hello ${values.name},<br><br>
              We're sorry to see you go. Your ${values.planName} subscription has been canceled as requested.
            </p>
            
            <div style="background-color: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">Important Information:</h3>
              <p style="color: #856404; margin: 5px 0;"><strong>Canceled On:</strong> ${values.canceledAt.toLocaleDateString()}</p>
              <p style="color: #856404; margin: 5px 0;"><strong>Access Until:</strong> ${values.accessUntil.toLocaleDateString()}</p>
              <p style="color: #856404; margin: 5px 0;">You'll continue to have access to your premium features until the end of your current billing period.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${values.reactivateUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">
                Reactivate Subscription
              </a>
              <a href="${values.feedbackUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Share Feedback
              </a>
            </div>

            <p style="color: #666666; font-size: 14px; line-height: 1.5; text-align: center;">
              Changed your mind? You can reactivate your subscription anytime before ${values.accessUntil.toLocaleDateString()}.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 40px; text-align: center; color: #999999; font-size: 14px; border-top: 1px solid #eeeeee;">
            <p>We hope to see you again soon!</p>
            <p>&copy; 2024 FleetSync. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    `,
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
