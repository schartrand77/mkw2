import nextVitals from 'eslint-config-next/core-web-vitals'

export default [
  ...nextVitals,
  {
    rules: {
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
    },
  },
]
