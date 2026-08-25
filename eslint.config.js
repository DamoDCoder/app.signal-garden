import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // src/gen is generated and proto/third_party are vendored: neither is
  // authored here, so neither is linted. The config file lints itself into a
  // circle, so it is out too.
  { ignores: ['dist', 'src/gen', 'proto', 'third_party', 'node_modules', 'eslint.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Generated 64-bit fields are bigint, and template-stringing one is a
      // deliberate render step rather than an accident.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
);
