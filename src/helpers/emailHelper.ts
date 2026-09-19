import { Resend } from 'resend'
import config from '../config'
import { errorLogger, logger } from '../shared/logger'
import { ISendEmail } from '../interfaces/email'

const resend = new Resend(config.email.resend_api_key)

const sendEmail = async (values: ISendEmail) => {
  try {
    const { data, error } = await resend.emails.send({
      from: config.email.from as string,
      to: values.to,
      subject: values.subject,
      html: values.html,
    })

    if (error) {
      errorLogger.error('Email', error)
      return
    }

    logger.info('Mail send successfully', data?.id)
  } catch (error) {
    errorLogger.error('Email', error)
  }
}

export const emailHelper = {
  sendEmail,
}
