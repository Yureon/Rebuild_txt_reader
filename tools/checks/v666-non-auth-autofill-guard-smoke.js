#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version');
const guardPath = path.join(root, 'public/scripts/non-auth-autofill-guard.js');
const cssPath = path.join(root, 'public/styles/non-auth-autofill-guard.css');
const source = fs.readFileSync(guardPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

require(guardPath);
const api = globalThis.__TXT_READER_NON_AUTH_AUTOFILL_GUARD__;
assert(api && api.version === 'v667', 'guard API/version must be exposed for diagnostics');

class FakeElement {
  constructor(tagName, attributes = {}) {
    this.nodeType = 1;
    this.tagName = String(tagName || '').toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.type = attributes.type || '';
    this.disabled = false;
    this.readOnly = false;
    this.value = '';
    this.events = [];
    this.scope = null;
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'type') this.type = String(value); if (name === 'readonly') this.readOnly = true; }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'readonly') this.readOnly = false; }
  matches(selector) {
    if (this.tagName === 'TEXTAREA') return selector.includes('textarea');
    if (this.tagName !== 'INPUT') return false;
    const type = String(this.getAttribute('type') || '').toLowerCase();
    if (!type) return selector.includes('input:not([type])');
    return selector.includes(`input[type="${type}"]`);
  }
  closest(selector) {
    if (selector === '[data-autofill-scope="credentials"]') return this.scope;
    if (selector.startsWith('[data-autofill-readonly-lock=')) return this.getAttribute('data-autofill-readonly-lock') ? this : null;
    return null;
  }
  dispatchEvent(event) { this.events.push(event.type); return true; }
  querySelectorAll() { return []; }
}

const search = new FakeElement('input', { type:'search', autocomplete:'off' });
assert.equal(api.guardControl(search), true);
assert.equal(search.getAttribute('autocomplete'), 'off');
assert.equal(search.getAttribute('data-form-type'), 'other');
assert.equal(search.getAttribute('data-lpignore'), 'true');
assert.equal(search.getAttribute('data-1p-ignore'), 'true');
assert.equal(search.getAttribute('data-bwignore'), 'true');
assert.equal(search.getAttribute('data-protonpass-ignore'), 'true');
assert.equal(search.getAttribute('data-keeper-ignore'), 'true');
assert.equal(search.getAttribute('data-autofill-guard'), 'v667');
assert.equal(search.getAttribute('data-autofill-readonly-lock'), 'v667');
assert.equal(search.readOnly, true, 'text/search controls must be readonly until the first user intent');
assert.equal(api.unlockControl(search), true);
assert.equal(search.readOnly, false);

search.value = 'unexpected-login-id';
assert.equal(api.clearDetectedAutofill({ animationName:'txt-reader-nonauth-autofill-start', target:search }), true);
assert.equal(search.value, '', 'detected browser autofill must be cleared from non-auth fields');
assert.deepEqual(search.events, ['input', 'change']);

search.value = 'user query';
search.setAttribute('data-autofill-user-edited', 'true');
assert.equal(api.clearDetectedAutofill({ animationName:'txt-reader-nonauth-autofill-start', target:search }), false);
assert.equal(search.value, 'user query', 'user-edited values must never be cleared');

const textarea = new FakeElement('textarea');
assert.equal(api.guardControl(textarea), true);
assert.equal(textarea.getAttribute('autocomplete'), 'off');
assert.equal(textarea.readOnly, false, 'textarea application state must not be altered');

const allowedPassword = new FakeElement('input', {
  type:'password',
  autocomplete:'current-password',
  'data-credential-autofill':'allow'
});
assert.equal(api.guardControl(allowedPassword), false);
assert.equal(allowedPassword.getAttribute('autocomplete'), 'current-password');
assert.equal(allowedPassword.getAttribute('data-autofill-guard'), null);

const form = new FakeElement('form');
assert.equal(api.guardForm(form), true);
assert.equal(form.getAttribute('autocomplete'), 'off');
assert.equal(form.getAttribute('data-form-type'), 'other');

assert(source.includes('new MutationObserver'), 'late fragments/dynamic controls must be observed');
assert(!source.includes('READONLY_FALLBACK_MS = 1200'), 'Whale hardening must not release readonly by timeout');
assert(!source.includes("addEventListener('focusin', unlockForUserIntent"), 'focus alone must not unlock non-auth fields');
assert(source.includes("addEventListener('input', blockUnexpectedFill"), 'unexpected autofill input events must be rejected');
assert(source.includes("attributeFilter:['type', 'autocomplete', 'contenteditable'"), 'type/autocomplete mutations must be guarded');
assert(css.includes('[data-autofill-guard="v667"]:-webkit-autofill'));
assert(css.includes('[data-autofill-guard="v667"]:autofill'));

const pages = [
  'public/index.html', 'public/library.html', 'public/metadata.html',
  'public/mobile.html', 'public/site.html', 'public/offline.html', 'public/admin/users.html'
];
for (const rel of pages) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(html.includes(`/scripts/non-auth-autofill-guard.js?v=${CURRENT_REBUILD_VERSION}`), `${rel}: guard script missing`);
  assert(html.includes(`/styles/non-auth-autofill-guard.css?v=${CURRENT_REBUILD_VERSION}`), `${rel}: autofill detection stylesheet missing`);
}
const login = fs.readFileSync(path.join(root, 'public/login.html'), 'utf8');
assert(!login.includes('non-auth-autofill-guard'), 'actual login/register page must retain standards-based credential autocomplete');
assert(login.includes('autocomplete="username"'));
assert(login.includes('autocomplete="current-password"'));

const deferred = fs.readFileSync(path.join(root, 'public/fragments/deferred-ui.html'), 'utf8');
for (const id of ['account-current-password', 'account-new-password', 'account-new-password-confirm']) {
  assert(new RegExp(`id="${id}"[^>]*data-credential-autofill="allow"`).test(deferred), `${id}: explicit credential allow marker missing`);
}
const shell = fs.readFileSync(path.join(root, 'public/fragments/app-shell.html'), 'utf8');
assert(shell.includes('id="search" type="search"'));
assert(shell.includes('id="library-tag-filter-search" type="search"'));
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
assert(sw.includes('`/scripts/non-auth-autofill-guard.js?v=${BUILD}`'));
assert(sw.includes('`/styles/non-auth-autofill-guard.css?v=${BUILD}`'));

console.log(JSON.stringify({
  pass:'v667-non-auth-autofill-guard-compat-pass',
  runtimeAssertions:25,
  pages:pages.length,
  vendorIgnoreAttributes:5,
  credentialAllowlist:3
}, null, 2));
