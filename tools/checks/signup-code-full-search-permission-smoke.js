const assert = require('assert');
const fs = require('fs');

const service = fs.readFileSync('server/services/signup-code-service.js', 'utf8');
const auth = fs.readFileSync('server/routes/auth-routes.js', 'utf8');
const admin = fs.readFileSync('server/routes/admin-users-routes.js', 'utf8');
const html = fs.readFileSync('public/admin/users.html', 'utf8');
const signupActions = fs.readFileSync('public/scripts/admin/signup-actions.js', 'utf8');
const signupView = fs.readFileSync('public/scripts/admin/signup.js', 'utf8');

assert.ok(service.includes('normalizeAppPermissions'), 'signup code service must normalize appPermissions');
assert.ok(service.includes('appPermissions: normalizeAppPermissions(record.appPermissions || {})'), 'signup code records must persist appPermissions');
assert.ok(service.includes('appPermissions: normalizeAppPermissions(input.appPermissions || {})'), 'signup code create must accept appPermissions');
assert.ok(service.includes('if (hasAppPermissions) record.appPermissions = nextAppPermissions;'), 'signup code update must accept appPermissions');
assert.ok(auth.includes('appPermissions: code.appPermissions || {}'), 'registration must transfer signup code appPermissions to new users');
assert.ok(admin.includes("appPermissions: { fields: ['fullSearch']"), 'admin status must advertise signup-code app permission controls');
assert.ok(html.includes('id="signup-code-full-search"'), 'signup code form must expose full search checkbox');
assert.ok(html.includes('v554-signup-code-full-search-permission-ui-pass'), 'signup code permission UI marker missing');
assert.ok(signupActions.includes("appPermissions:appPermissionsPayload(ctx, 'signup-code')"), 'signup code create payload must include appPermissions');
assert.ok(signupView.includes('전체검색 '), 'signup code list must show full search permission');

console.log('signup-code-full-search-permission-smoke ok');
