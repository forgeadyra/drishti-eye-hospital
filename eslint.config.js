import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.netlify', 'lighthouse-*'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, jsxA11y.flatConfigs.strict],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': 'error',
      'no-debugger': 'error',
      // External links must go through <ExternalLink>, which always sets rel="noopener noreferrer".
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='target'][value.value='_blank']",
          message: 'Use <ExternalLink> for target="_blank" links.',
        },
      ],
    },
  },
  {
    // R3F idiom: three.js objects (uniforms, camera, scene) are mutated imperatively inside
    // useFrame/effects by design; that's how the render loop avoids React re-renders.
    files: ['src/three/**/*.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    files: ['src/components/ExternalLink.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['netlify/**/*.{ts,mts}', 'vite.config.ts', 'config/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    // page.evaluate() callbacks run in the browser
    files: ['scripts/qa-browser.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
