/**
 * Flat ESLint config using core rules only, with JSX parsing enabled.
 * Deliberately plugin-free: fewer moving parts to keep in sync, and the
 * React-specific conventions in this codebase are small enough to hold by
 * review rather than by rule.
 */
const BROWSER_GLOBALS = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  WebSocket: 'readonly',
  URL: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  navigator: 'readonly',
  XMLHttpRequest: 'readonly',
  FormData: 'readonly',
  AbortController: 'readonly',
  IntersectionObserver: 'readonly',
  URL: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: BROWSER_GLOBALS,
    },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[_A-Z]' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
  {
    files: ['src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...BROWSER_GLOBALS, process: 'readonly' },
    },
  },
];
