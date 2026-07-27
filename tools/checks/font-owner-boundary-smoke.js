const assert = require('assert');
const { runFontUserScopeSmoke } = require('./font-user-scope-smoke');
function runFontOwnerBoundarySmoke() {
  const result = runFontUserScopeSmoke();
  assert.strictEqual(result.pass, 'v426-user-font-library-scope-smoke-pass');
  return { pass:'v426-font-owner-boundary-replaced-by-user-scope-pass', scopePass:result.pass };
}
if (require.main === module) console.log(JSON.stringify(runFontOwnerBoundarySmoke()));
module.exports = { runFontOwnerBoundarySmoke };
