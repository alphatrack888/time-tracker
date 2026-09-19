const { FlatCompat } = require('@eslint/eslintrc')
const js = require('@eslint/js')

const compat = new FlatCompat({ baseDirectory: __dirname, recommendedConfig: js.configs.recommended })

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'uploads/**'] },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
]
