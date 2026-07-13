/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^shared/(.*)$': '<rootDir>/shared/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },
  // Quarantined drifted suites — see test/e2e-legacy/README.md
  testPathIgnorePatterns: ['/node_modules/', '/test/e2e-legacy/'],
  automock: false,
  setupFiles: ['<rootDir>/test/jest-env.js'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup-after.js'],
  globalTeardown: '<rootDir>/test/global-teardown.js',
  // Suites share one test database and setupDb drops/recreates the public
  // schema per suite — parallel workers race on DROP/CREATE SCHEMA and on
  // concurrent `prisma generate`. Single worker keeps runs deterministic.
  maxWorkers: 1,
};
