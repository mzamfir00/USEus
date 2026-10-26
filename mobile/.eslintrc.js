// Static checks that a bundler can't do: undefined names, missing named imports, hook rules.
module.exports = {
  root: true,
  extends: ['expo'],
  env: { es2022: true, node: true },
  globals: { structuredClone: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly' },
  ignorePatterns: ['dist/', 'android/', 'ios/', 'node_modules/', 'scripts/', '.eslintrc.js'],
  rules: {
    'no-undef': 'error',
    'react/jsx-no-undef': 'error',
    'import/named': 'error',
    'import/no-unresolved': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
  },
  settings: {
    'import/resolver': { node: { extensions: ['.js', '.jsx'] } },
  },
};
