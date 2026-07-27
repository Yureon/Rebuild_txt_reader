const fs = require('fs');
const assert = require('assert');

const ui = fs.readFileSync('public/scripts/rebuild/features/ui.mjs', 'utf8');
const css = fs.readFileSync('public/styles/app.css', 'utf8');

assert.ok(
  ui.includes("v478-status-pill-bars-visibility-role-pass"),
  'bars visibility role marker missing'
);
assert.ok(
  ui.includes('const isBarsVisibilityStatus') &&
  ui.includes("kind === 'reader'") &&
  ui.includes('상단\\/하단바 (숨김|표시)'),
  'status() must detect reader bars visibility messages'
);
assert.ok(
  ui.includes("pill.dataset.statusPillRole = 'bars-visibility'"),
  'bars visibility status must set dataset role'
);
assert.ok(
  ui.includes("dock.setAttribute('aria-live', 'polite')") &&
  ui.includes("dock.setAttribute('aria-atomic', 'false')"),
  'status dock must expose polite live-region attributes'
);
assert.ok(
  css.includes('[data-status-pill-role="bars-visibility"]'),
  'bars visibility role CSS selector missing'
);
assert.ok(
  !ui.includes('applyStatusPillInlineHeightLock') &&
  !ui.includes('pillStatusSamsungPwaInlineLockPass'),
  'Samsung PWA inline height lock must remain removed'
);

console.log('v478-status-pill-bars-visibility-role-smoke-pass');
