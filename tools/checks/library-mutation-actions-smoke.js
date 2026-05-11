const fs = require('fs');
const path = require('path');

const LIBRARY_MUTATION_ACTIONS_SMOKE_PASS = 'v276-library-mutation-actions-smoke-pass';

function runLibraryMutationActionsSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const library = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library.mjs'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'library-mutation-actions.mjs'), 'utf8');
  ['runLibraryRenameRequest','runLibraryMoveRequest','runLibraryDeleteRequest','isCurrentDeletedByTarget'].forEach(name => {
    if (!actions.includes(`export ${name === 'isCurrentDeletedByTarget' ? 'function' : 'async function'} ${name}`)) throw new Error('library-mutation-actions missing export: ' + name);
  });
  if (!library.includes("from './library-mutation-actions.mjs'")) throw new Error('library.mjs must import mutation action helpers');
  ['app.api.renameFolder','app.api.renameEpisode','app.api.renameNovel','app.api.moveFolder','app.api.moveEpisode','app.api.moveNovel','app.api.deleteFolder','app.api.deleteEpisode','app.api.deleteNovel'].forEach(fragment => {
    if (library.includes(fragment)) throw new Error('direct API mutation branch returned to library.mjs: ' + fragment);
  });
  return { pass: LIBRARY_MUTATION_ACTIONS_SMOKE_PASS };
}

module.exports = { LIBRARY_MUTATION_ACTIONS_SMOKE_PASS, runLibraryMutationActionsSmoke };
