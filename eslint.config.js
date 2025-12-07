import js from '@eslint/js';
import globals from 'globals';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import css from '@eslint/css';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: [
      '.venv/**',
      'node_modules/**',
      '*.pyc',
      '__pycache__/**',
      '.pytest_cache/**',
      '.ruff_cache/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern:
            '^(apiGet|apiPost|showApiError|hashString|isPolygonInsidePolygon|isPointInPolygon|pointModeEnabled|boxModeEnabled|getSupercategoryColorLocal)$',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
    rules: {
      'json/no-empty-keys': 'off',
    },
  },
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.json5'],
    plugins: { json },
    language: 'json/json5',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/commonmark',
    extends: ['markdown/recommended'],
    rules: {
      'markdown/fenced-code-language': 'off',
      'markdown/no-missing-label-refs': 'off',
    },
  },
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    extends: ['css/recommended'],
    rules: {
      'css/use-baseline': 'off',
      // Allow !important for overriding inline styles set by JavaScript
      'css/no-important': 'off',
    },
  },
]);
