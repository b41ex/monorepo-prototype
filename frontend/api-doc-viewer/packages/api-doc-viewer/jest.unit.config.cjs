module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(/src/.*\\.(test|spec))\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@apihub/types$': '<rootDir>/src/types',
    '^@apihub/types/(.*)$': '<rootDir>/src/types/$1',
    '^@apihub/next-data-model$': '<rootDir>/../next-data-model/src',
    '^@apihub/next-data-model/(.*)$': '<rootDir>/../next-data-model/src/$1',
    '^@b41ex/qubership-apihub-next-data-model$': '<rootDir>/../next-data-model/src',
    '^@b41ex/qubership-apihub-next-data-model/(.*)$': '<rootDir>/../next-data-model/src/$1',
  },
  testEnvironment: 'node',
  collectCoverage: false,
}
