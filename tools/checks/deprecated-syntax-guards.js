const fs = require('fs');
const path = require('path');

const DEPRECATED_SYNTAX_GUARD_PASS = 'v276-deprecated-syntax-guard-pass';
const DEPRECATED_SYNTAX_GUARD_V294_BROWSER_WARNING_PASS = 'v294-browser-warning-guard-pass';
const BANNED_SNIPPETS = [
  { label: 'obfuscated comma assignment', pattern: /\bh1\s*=\s*J\s*\[\s*V\s*\]\s*,/ },
  { label: 'pasted obfuscated split marker', pattern: /\b[A-Za-z_$][\w$]*\s*=\s*['"]nAsAa['"]\.split\(['"]A['"]\)/ },
  { label: 'pasted obfuscated hk(xr.* marker', pattern: /\bhk\s*\(\s*xr\./ },
  { label: 'pasted obfuscated U[L] assignment marker', pattern: /\bN0\s*=\s*U\s*\[\s*L\s*\]/ },
  { label: 'Protected Audience joinAdInterestGroup API', pattern: /\b(?:navigator\s*\.\s*)?joinAdInterestGroup\s*\(/ },
  { label: 'Protected Audience runAdAuction API', pattern: /\b(?:navigator\s*\.\s*)?runAdAuction\s*\(/ },
  { label: 'Protected Audience leaveAdInterestGroup API', pattern: /\b(?:navigator\s*\.\s*)?leaveAdInterestGroup\s*\(/ },
  { label: 'Protected Audience API warning string', pattern: /Protected\s+Audience\s+API/i }
];
const SCAN_DIRS = [
  'public/scripts/rebuild',
  'public/fragments',
  'public/index.html',
  'public/site.html',
  'public/mobile.html'
];
const TEXT_EXTENSIONS = new Set(['.mjs', '.js', '.html']);

function collectScanFiles(projectRoot) {
  const files = [];
  const visit = rel => {
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) return;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full)) visit(path.join(rel, name));
      return;
    }
    if (TEXT_EXTENSIONS.has(path.extname(full))) files.push(rel.replace(/\\/g, '/'));
  };
  SCAN_DIRS.forEach(visit);
  return files.sort();
}

function runDeprecatedSyntaxGuards(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const files = collectScanFiles(root);
  const hits = [];
  for (const rel of files) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const rule of BANNED_SNIPPETS) {
      if (rule.pattern.test(source)) hits.push(`${rel}: ${rule.label}`);
    }
  }
  if (hits.length) throw new Error('deprecated/obfuscated syntax fragments found: ' + hits.join('; '));
  return { pass: DEPRECATED_SYNTAX_GUARD_PASS, browserWarningPass: DEPRECATED_SYNTAX_GUARD_V294_BROWSER_WARNING_PASS, checked: files.length, bannedFragments: BANNED_SNIPPETS.length };
}

module.exports = { DEPRECATED_SYNTAX_GUARD_PASS, DEPRECATED_SYNTAX_GUARD_V294_BROWSER_WARNING_PASS, runDeprecatedSyntaxGuards };
