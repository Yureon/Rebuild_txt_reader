const fs = require('fs');
const path = require('path');

const LIBRARY_PATHS_SMOKE_PASS = 'v276-library-paths-smoke-pass';

function runLibraryPathsSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const library = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library.mjs'), 'utf8');
  const paths = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library-paths.mjs'), 'utf8');
  ['formatFolderPath','parentFolderPath','normalizePromptCategory','categoryFromStoragePath','getCurrentLibraryPath','openOptionsFromSnapshot'].forEach(name => {
    if (!paths.includes(`export function ${name}`)) throw new Error('library-paths missing export: ' + name);
  });
  if (!library.includes("from './library-paths.mjs'")) throw new Error('library.mjs must import path helpers from library-paths.mjs');
  ['function formatFolderPath','function parentFolderPath','function normalizePromptCategory','function categoryFromStoragePath','function getCurrentLibraryPath','function openOptionsFromSnapshot'].forEach(fragment => {
    if (library.includes(fragment)) throw new Error('path helper returned to library.mjs: ' + fragment);
  });
  return { pass: LIBRARY_PATHS_SMOKE_PASS };
}

module.exports = { LIBRARY_PATHS_SMOKE_PASS, runLibraryPathsSmoke };
