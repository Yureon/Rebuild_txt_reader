#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const PASS = 'v427-font-account-scope-ui-smoke-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function runFontAccountScopeUiSmoke() {
  const shell = read('public/fragments/app-shell.html');
  const fonts = read('public/scripts/rebuild/features/settings/fonts.mjs');
  const card = read('public/scripts/rebuild/features/settings/font-choice-card.mjs');
  const appearance = read('public/scripts/rebuild/features/settings/appearance.mjs');
  const doc = read('docs/user-data-isolation.md');
  assert.ok(shell.includes('내 계정 전용 글꼴'), 'font modal must label uploaded fonts as account-only');
  assert.ok(shell.includes('data-font-account-scope-marker="v427"'), 'font modal must include v427 account-scope marker');
  assert.ok(shell.includes('owner와 다른 일반 사용자에게 공유되지 않으며'), 'font modal help must state fonts are not shared with other users');
  assert.ok(fonts.includes('v427-settings-account-font-scope-ui-pass'), 'fonts module marker missing');
  assert.ok(fonts.includes("'내 계정 기본'"), 'font summary must use account-default label');
  assert.ok(fonts.includes("'내 계정 전용'"), 'font status must include account-only label');
  assert.ok(fonts.includes('dataset.fontAccountScope'), 'font list must expose scope dataset for DOM smoke');
  assert.ok(card.includes('v427-settings-account-font-labels-pass'), 'font card label marker missing');
  assert.ok(card.includes("text: '계정'"), 'font active badge must say account instead of shared');
  assert.ok(card.includes("'내 계정 적용'"), 'font action must say apply to my account');
  assert.ok(card.includes("'계정 적용됨'"), 'font active action must say applied to account');
  assert.ok(!card.includes("'공유 적용'"), 'old shared action label must be removed');
  assert.ok(!card.includes("'공유 적용됨'"), 'old shared active label must be removed');
  assert.ok(appearance.includes('내 계정 기본 글꼴을 사용 중입니다.'), 'appearance title must use account-default wording');
  assert.ok(doc.includes('v427-account-font-scope-ui-pass'), 'user data isolation doc marker missing');
  return { pass: PASS };
}
if (require.main === module) console.log(JSON.stringify(runFontAccountScopeUiSmoke()));
module.exports = { runFontAccountScopeUiSmoke };
