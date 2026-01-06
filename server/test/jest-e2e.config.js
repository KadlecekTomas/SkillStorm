/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname + '/..',
  testEnvironment: 'node',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$', // <— jen e2e složka
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^shared/(.*)$': '<rootDir>/shared/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },
  automock: false,
  setupFiles: ['<rootDir>/test/jest-env.js'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup-after.js'],
  maxWorkers: 1,
  testTimeout: 120000,
};
