/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTestEnv.ts'],
  testTimeout: 30000,
  // mongodb-memory-server downloads/starts a real mongod per worker; keep it
  // to one worker so we don't spin up N in-memory Mongo instances in CI.
  maxWorkers: 1,
  clearMocks: true,
};
