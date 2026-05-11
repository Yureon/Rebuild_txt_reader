#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const shell = read('public/fragments/app-shell.html');
const css = read('public/styles/app.css');
const dataTools = read('public/scripts/rebuild/features/settings/data-tools.mjs');
const elements = read('public/scripts/rebuild/features/ui/elements.mjs');
const api = read('public/scripts/rebuild/core/api.mjs');
assert.ok(shell.includes('data-account-password-card="v564"'), 'account password card marker must be v564');
assert.ok(shell.includes('settings-password-input'), 'password inputs must use unified settings password style class');
assert.ok(!shell.includes('owner 계정은 .env LOGINPW로 관리합니다.'), 'owner password guide must be removed from general settings');
assert.ok(shell.includes('settings-logout-btn') && shell.includes('settings-logout-status'), 'general settings logout controls must exist');
assert.ok(shell.includes('data-settings-bottom-actions="v564"'), 'shortcut/logout bottom action row missing');
assert.ok(shell.includes('data-account-logout-card="v564"'), 'logout action must be moved to bottom row marker');
assert.ok(!shell.includes('data-account-logout-card="v562"'), 'logout action must not remain in data/advanced card');
assert.ok(css.includes('#settings-logout-btn') && css.includes('settings-password-input'), 'password/logout styles must exist');
assert.ok(css.includes('#account-password-overlay') && css.includes('#account-password-modal'), 'account password modal z-index override missing');
assert.ok(elements.includes('settings-logout-btn') && elements.includes('settings-logout-status'), 'UI element map must include logout controls');
assert.ok(api.includes("logout(options) { return this.post('/api/logout'"), 'ApiClient logout method must exist');
assert.ok(dataTools.includes('settingsLogoutBtn') && dataTools.includes("location.href = '/login.html'"), 'settings logout handler must redirect to login');
console.log(JSON.stringify({ pass: 'v564-settings-account-ui-smoke-pass' }));
