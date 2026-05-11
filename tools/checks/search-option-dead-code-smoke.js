const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v417-search-option-dead-code-smoke-pass';
const inspected = [
  'public/fragments/app-shell.html',
  'public/scripts/rebuild/features/search.mjs',
  'public/scripts/rebuild/features/search/matcher.mjs',
  'public/scripts/rebuild/features/search/results-view.mjs',
  'public/scripts/rebuild/features/search/status-panel.mjs',
  'public/scripts/rebuild/features/search/coverage-summary.mjs',
  'public/scripts/rebuild/features/search/search-worker.js',
  'public/styles/app.css'
];
const banned = [
  /대소문자\s*구분/,
  /\bnsearch-case\b/i,
  /\bcaseSensitive(Search|Checkbox|Toggle)?\b/,
  /\bsearchCaseSensitive\b/,
  /캐시\s*범위만\s*검색/,
  /\bnsearch-cache-only\b/i,
  /\bcacheOnlyCheckbox\b/,
  /\bcacheRangeOnly\b/
];
const offenders = [];
for (const rel of inspected) {
  const file = path.join(root, rel);
  assert.ok(fs.existsSync(file), rel + ' must exist');
  const text = fs.readFileSync(file, 'utf8');
  for (const rx of banned) {
    if (rx.test(text)) offenders.push(rel + ' :: ' + rx);
  }
}
assert.deepStrictEqual(offenders, [], 'removed search modal option residue found: ' + offenders.join(', '));
console.log(PASS);
