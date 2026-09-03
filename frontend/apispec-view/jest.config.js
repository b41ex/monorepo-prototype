module.exports = {
  preset: '@stoplight/scripts',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/../../setupTests.ts'],
  snapshotSerializers: ['enzyme-to-json/serializer'],
  testMatch: ['<rootDir>/src/**/*.(spec|test).(ts|js)?(x)'],
  coveragePathIgnorePatterns: ['__tests__', '__fixtures__', '__stories__'],
  testTimeout: 10000,
  // An array of directory names to be searched recursively up from the requiring module's location
  moduleDirectories: ['node_modules'],
  moduleNameMapper: {
    '^@b41ex/qubership-apihub-apispec-view$': '<rootDir>/../elements/src',
    '^@b41ex/qubership-apihub-apispec-view/(.*)': '<rootDir>/../elements/src/$1',
    '^@b41ex/qubership-apihub-apispec-view-elements-core$': '<rootDir>/../elements-core/src',
    '^@b41ex/qubership-apihub-apispec-view-elements-core/(.*)': '<rootDir>/../elements-core/src/$1',
    '^@b41ex/qubership-apihub-apispec-view-json-schema-viewer$': '<rootDir>/../json-schema-viewer/src',
    '^@b41ex/qubership-apihub-apispec-view-json-schema-diff-viewer$': '<rootDir>/../json-schema-diff-viewer/src',
  },
};
