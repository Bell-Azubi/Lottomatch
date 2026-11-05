import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Builds a `no-restricted-imports` rule that forbids the given layer folders. */
function forbidLayers(layers, message, extraPatterns = []) {
  return [
    'error',
    {
      patterns: [{ regex: `(^|/)(${layers.join('|')})(/|$)`, message }, ...extraPatterns],
    },
  ];
}

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'src/**/*.module.css.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      'max-lines': ['error', { max: 300, skipBlankLines: false, skipComments: false }],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is banned: use the RandomSource port (crypto.getRandomValues).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned (CSP and XSS).',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['src/domain/**/*.test.ts'],
    rules: {
      'no-restricted-imports': forbidLayers(
        ['application', 'infrastructure', 'ui', 'i18n'],
        'The domain layer imports nothing.',
        [{ regex: '^[^./]', message: 'The domain layer imports no packages.' }],
      ),
    },
  },
  {
    files: ['src/application/**/*.ts'],
    ignores: ['src/application/**/*.test.ts'],
    rules: {
      'no-restricted-imports': forbidLayers(
        ['infrastructure', 'ui', 'i18n'],
        'The application layer depends on the domain only.',
      ),
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidLayers(
        ['ui', 'i18n'],
        'Infrastructure must not import the UI.',
      ),
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': forbidLayers(
        ['infrastructure'],
        'The UI reaches infrastructure only through application ports.',
      ),
    },
  },
  {
    files: ['src/i18n/**/*.ts'],
    rules: {
      'no-restricted-imports': forbidLayers(
        ['application', 'infrastructure', 'ui'],
        'Catalogues depend on domain types only.',
      ),
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'eslint.config.js',
      '*.config.ts',
      'build/**/*.ts',
      'tests/e2e/**/*.ts',
    ],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
);
