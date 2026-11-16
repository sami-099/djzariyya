import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist', 'coverage', '.venv'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
];
