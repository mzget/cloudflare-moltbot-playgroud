import typescriptEslintParser from '@typescript-eslint/parser';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';

const mockReactHooksPlugin = {
  rules: {
    'exhaustive-deps': {
      meta: { type: 'suggestion' },
      create(context) { return {}; }
    },
    'rules-of-hooks': {
      meta: { type: 'suggestion' },
      create(context) { return {}; }
    }
  }
};

export default [
  {
    ignores: ['src/env.d.ts', '.astro/**', 'dist/**', 'node_modules/**']
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    }
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      'react-hooks': mockReactHooksPlugin,
    },
    rules: {
      ...typescriptEslintPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
