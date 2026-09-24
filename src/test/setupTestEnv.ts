import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

// Ensure config values the app reads at import-time exist, without
// depending on the developer's local .env (CI has no .env file).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'
process.env.JWT_EXPIRE_IN = process.env.JWT_EXPIRE_IN || '1h'
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4' // low cost factor: tests hash real passwords

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}, 60000)

afterEach(async () => {
  const collections = mongoose.connection.collections
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({})
  }
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongod) {
    await mongod.stop()
  }
}, 30000)
