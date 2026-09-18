/* eslint-disable no-undef */
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

export default {
  ip_address: process.env.IP_ADDRESS,
  database_url: process.env.DATABASE_URL,

  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY,
    account_id: process.env.STRIPE_ACCOUNT_ID,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,

  },



  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  firebase_service_account_base64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
  google: {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    callback_url: process.env.GOOGLE_CALLBACK_URL,
  },
  super_admin:{
    email:process.env.SUPER_ADMIN_EMAIL,
    password:process.env.SUPER_ADMIN_PASSWORD
  },
  jwt: {
    jwt_secret: process.env.JWT_SECRET,
    jwt_expire_in: process.env.JWT_EXPIRE_IN,
    jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
    jwt_refresh_expire_in: process.env.JWT_REFRESH_EXPIRES_IN,
    temp_jwt_secret: process.env.TEMP_JWT_SECRET,
    temp_jwt_expire_in: process.env.TEMP_JWT_EXPIRE_IN,
  },
  application_fee: process.env.APPLICATION_FEE,
  instant_transfer_fee: process.env.INSTANT_TRANSFER_FEE,
  openAi_api_key: process.env.OPENAI_API_KEY,

  webhook_secret: process.env.WEBHOOK_SECRET,
  email: {
    from: process.env.EMAIL_FROM,
    user: process.env.EMAIL_USER,
    port: process.env.EMAIL_PORT,
    host: process.env.EMAIL_HOST,
    pass: process.env.EMAIL_PASS,
  },
  cloudinary: {
    cloudinary_name: process.env.CLOUDINARY_NAME,
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
    cloudinary_secret: process.env.CLOUDINARY_SECRET,
  },
}
