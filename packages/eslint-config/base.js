import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shared flat ESLint config for TypeScript packages in this monorepo.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      // tsup writes a transient bundled config file (e.g.
      // `tsup.config.bundled_<hash>.mjs`) into the package root while
      // building. When `lint` and `build` run concurrently under turbo,
      // ESLint can pick the file up in its scan and then race tsup's
      // cleanup, producing an ENOENT. Ignoring the pattern eliminates the
      // race without serializing the tasks.
      '**/tsup.config.bundled_*.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
    },
  },
);
