const { FlatCompat } = require('@eslint/eslintrc')
const js = require('@eslint/js')

const compat = new FlatCompat({ baseDirectory: __dirname, recommendedConfig: js.configs.recommended })

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'uploads/**', 'eslint.config.js', 'jest.config.js'] },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),
  {
    rules: {
      // Leading-underscore params are allowed to stay unused — used for
      // parameters kept for a documented future implementation or a
      // consistent handler signature, without deleting them outright.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
]
