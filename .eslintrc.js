module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
    browser: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    // Prettier integration
    'prettier/prettier': 'error',

    // General ESLint rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',
    'prefer-const': 'error',
    'no-var': 'error',

    // Code style
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'comma-dangle': ['error', 'always-multiline'],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
  },
  overrides: [
    {
      // Frontend-specific rules
      files: ['frontend/**/*.js'],
      env: {
        browser: true,
        webextensions: true,
      },
      globals: {
        chrome: 'readonly',
      },
    },
    {
      // Backend-specific rules
      files: ['backend/**/*.js'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off', // Allow console in backend
      },
    },
    {
      // Configuration files
      files: ['*.config.js', '.eslintrc.js'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'build/', '*.min.js', 'coverage/'],
};
