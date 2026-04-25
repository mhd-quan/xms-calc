module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  extends: ['eslint:recommended'],
  ignorePatterns: ['dist/', 'out/', '.vite/', 'node_modules/', 'archive/**', 'src/renderer/app.js']
}
