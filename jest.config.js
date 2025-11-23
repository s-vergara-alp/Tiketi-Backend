module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/database/seed.js',
    '!src/database/migrate.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  globalTeardown: '<rootDir>/tests/teardown.js',
  testTimeout: 30000,
  maxWorkers: 1, // Run tests sequentially to avoid rate limiting
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  moduleFileExtensions: [
    'js',
    'json'
  ],
  transform: {},
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  // Add these settings to try to isolate tests better
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true
};

