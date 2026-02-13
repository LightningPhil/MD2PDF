import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

const browserGlobals = {
  document: 'readonly',
  window: 'readonly',
  HTMLElement: 'readonly',
  HTMLCanvasElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLSelectElement: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLDivElement: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  DragEvent: 'readonly',
  ClipboardEvent: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  crypto: 'readonly',
  CanvasRenderingContext2D: 'readonly',
  OffscreenCanvas: 'readonly',
  FontFace: 'readonly',
  Path2D: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  fetch: 'readonly',
  Response: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  localStorage: 'readonly',
  getComputedStyle: 'readonly',
  navigator: 'readonly',
  performance: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
};

export default [
  eslint.configs.recommended,
  prettierConfig,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: browserGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // General rules
      'no-unused-vars': 'off', // Use TypeScript's version
      'no-console': 'off', // Allow console for debugging
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-useless-escape': 'warn', // Downgrade to warning
      'no-useless-assignment': 'off', // Allow intentional default values

      // Prettier integration
      'prettier/prettier': 'warn',
    },
  },
  {
    // Tests use vitest config which includes them
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...browserGlobals,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'off',
      'prettier/prettier': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'],
  },
];
