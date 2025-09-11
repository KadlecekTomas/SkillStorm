/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^shared/(.*)$': '<rootDir>/shared/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },
  automock: false,
  setupFiles: ['<rootDir>/test/jest-env.js'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup-after.js'],
  globalTeardown: '<rootDir>/test/global-teardown.js',
};
