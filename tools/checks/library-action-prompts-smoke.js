const fs = require('fs');
const path = require('path');

const LIBRARY_ACTION_PROMPTS_SMOKE_PASS = 'v276-library-action-prompts-smoke-pass';

function runLibraryActionPromptsSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const library = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library.mjs'), 'utf8');
  const prompts = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library-action-prompts.mjs'), 'utf8');
  ['promptLibraryRename','confirmLibraryDelete','confirmLibraryMove','buildLibraryMoveConfirmMessage'].forEach(name => {
    if (!prompts.includes(`export function ${name}`)) throw new Error('library-action-prompts missing export: ' + name);
  });
  if (!library.includes("from './library-action-prompts.mjs'")) throw new Error('library.mjs must import prompt helpers');
  if (/window\.(prompt|confirm)/.test(library)) throw new Error('direct window prompt/confirm returned to library.mjs');
  if (!prompts.includes('buildLibraryDeleteConfirmMessage')) throw new Error('delete confirmation copy must stay in prompt helper');
  return { pass: LIBRARY_ACTION_PROMPTS_SMOKE_PASS };
}

module.exports = { LIBRARY_ACTION_PROMPTS_SMOKE_PASS, runLibraryActionPromptsSmoke };
