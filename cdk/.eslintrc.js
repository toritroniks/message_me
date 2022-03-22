module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'require-await': 'warn',
    'max-lines-per-function': [
      'warn',
      { max: 40, skipBlankLines: true, skipComments: true },
    ],
    'max-depth': ['warn', 3],
    'no-lonely-if': 'error',
    'consistent-return': ['error', { treatUndefinedAsUnspecified: false }],
    complexity: ['warn', { max: 20 }],
  },
};
