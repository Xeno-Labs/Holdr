// Polyfill Node.js `global` for browser bundles that reference it
if (typeof globalThis !== 'undefined') {
  module.exports = globalThis;
} else if (typeof window !== 'undefined') {
  module.exports = window;
} else {
  module.exports = {};
}
