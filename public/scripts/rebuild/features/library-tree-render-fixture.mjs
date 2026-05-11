export const LIBRARY_TREE_RENDER_FIXTURE_PASS = 'v283-library-tree-render-fixture-pass';
export const LIBRARY_TREE_RENDER_FIXTURE_V292_PASS = 'v292-library-tree-render-fixture-contract-pass';

export function getLibraryTreeRenderFixtureContract() {
  return {
    pass: LIBRARY_TREE_RENDER_FIXTURE_PASS,
    contractPass: LIBRARY_TREE_RENDER_FIXTURE_V292_PASS,
    rendererPass: 'v292-library-tree-renderer-pass',
    rootDropZoneSelector: '.library-root-dropzone[data-drop-type="root"]',
    folderRowSelector: '.cat-header[data-drag-type="folder"] .folder-action-btn[data-type="folder"]',
    novelRowSelector: '.novel-item[data-drag-type="novel"] .novel-action-btn[data-type="novel"]',
    episodeRowSelector: '.ep-item[data-drag-type="episode"] .episode-action-btn[data-type="episode"]',
    rowSelectors: ['.cat-header', '.novel-item', '.ep-item'],
    actionButtonClasses: ['folder-action-btn', 'novel-action-btn', 'episode-action-btn'],
    actionTypes: ['folder', 'novel', 'episode'],
    dragTypes: ['folder', 'novel', 'episode'],
    requiredDatasets: {
      rootDropZone: ['dropType', 'folderKey'],
      folder: ['dragType', 'folderKey'],
      novel: ['dragType', 'novelId'],
      episode: ['dragType', 'novelId', 'episodeId']
    },
    metadataClasses: ['novel-title', 'novel-meta', 'progress-bar', 'progress-fill'],
    stateClasses: ['collapsed', 'active', 'open'],
    splitBoundaries: {
      orchestrator: 'library.mjs',
      rowRenderer: 'library-tree-renderer.mjs',
      prototypeRenderer: 'library-prototype-rows.mjs',
      virtualRowsRuntime: 'library-virtual-rows-runtime.mjs'
    },
    purpose: 'fixture contract for future full tree renderer split'
  };
}

export function summarizeLibraryTreeRenderFixtureContract(contract = getLibraryTreeRenderFixtureContract()) {
  return {
    pass: contract.pass,
    contractPass: contract.contractPass,
    rendererPass: contract.rendererPass,
    rowSelectorCount: contract.rowSelectors?.length || 0,
    actionTypeCount: contract.actionTypes?.length || 0,
    metadataClassCount: contract.metadataClasses?.length || 0,
    splitBoundaries: { ...(contract.splitBoundaries || {}) }
  };
}

export const LIBRARY_TREE_RENDER_FIXTURE_V293_PASS = 'v293-library-tree-render-fixture-dom-snapshot-pass';

export function getLibraryTreeRenderFixtureDomSnapshotContract() {
  return {
    pass: LIBRARY_TREE_RENDER_FIXTURE_V293_PASS,
    rootSelector: '.novel-list',
    requiredSelectors: [
      '.library-root-dropzone[data-drop-type="root"]',
      '.cat-header[data-drag-type="folder"] .folder-title',
      '.cat-header[data-drag-type="folder"] .folder-action-btn[data-type="folder"]',
      '.cat-body',
      '.novel-item[data-drag-type="novel"] .novel-title',
      '.novel-item[data-drag-type="novel"] .novel-meta',
      '.novel-item[data-drag-type="novel"] .progress-bar .progress-fill',
      '.ep-list.open .ep-item[data-drag-type="episode"] .ep-title',
      '.ep-item[data-drag-type="episode"] .episode-action-btn[data-type="episode"]'
    ],
    requiredDatasetBySelector: {
      '.library-root-dropzone': ['dropType', 'folderKey'],
      '.cat-header': ['dragType', 'folderKey'],
      '.folder-action-btn': ['type', 'folderKey'],
      '.novel-item': ['dragType', 'novelId'],
      '.novel-action-btn': ['type', 'novelId'],
      '.ep-item': ['dragType', 'novelId', 'episodeId'],
      '.episode-action-btn': ['type', 'novelId', 'episodeId']
    },
    sampleFixtureShape: {
      folders: ['root > nested'],
      rows: ['root-dropzone', 'cat-header', 'cat-body', 'novel-item', 'ep-list', 'ep-item'],
      activeRows: ['novel-item.active', 'ep-item.active'],
      collapsedRows: ['cat-header.collapsed']
    },
    splitBoundary: 'full tree DOM snapshot contract before renderer extraction'
  };
}

export function validateLibraryTreeRenderFixtureDomSnapshot(root, contract = getLibraryTreeRenderFixtureDomSnapshotContract()) {
  const scope = root?.querySelector ? root : null;
  if (!scope) return { pass: contract.pass, ok: false, reason: 'missing-root', missingSelectors: contract.requiredSelectors || [] };
  const missingSelectors = (contract.requiredSelectors || []).filter(selector => !scope.querySelector(selector));
  const datasetMissing = [];
  for (const [selector, keys] of Object.entries(contract.requiredDatasetBySelector || {})) {
    const el = scope.querySelector(selector);
    if (!el) continue;
    const missing = (keys || []).filter(key => !(key in (el.dataset || {})));
    if (missing.length) datasetMissing.push({ selector, missing });
  }
  return {
    pass: contract.pass,
    ok: missingSelectors.length === 0 && datasetMissing.length === 0,
    missingSelectors,
    datasetMissing,
    checkedAt: Date.now()
  };
}

export const LIBRARY_TREE_RENDER_FIXTURE_V294_PASS = 'v294-library-tree-render-fixture-browser-sample-pass';

export function getLibraryTreeRenderBrowserFixtureSample() {
  return {
    pass: LIBRARY_TREE_RENDER_FIXTURE_V294_PASS,
    description: 'Browser DOM sample for validating split full-tree renderer output after nested folder, multi-file, active, favorite, bookmark, and collapsed state rendering.',
    stateShape: {
      collapsedFolders: ['Series>Archived'],
      expandedEpisodeNovels: ['novel-multi'],
      favorites: ['novel-single'],
      current: { novelId: 'novel-multi', episodeId: 'episode-2' },
      bookmarks: [{ novelId: 'novel-single' }]
    },
    expectedCounts: {
      rootDropZone: 1,
      folderRowsAtLeast: 2,
      novelRowsAtLeast: 2,
      episodeRowsAtLeast: 2,
      activeRowsAtLeast: 1,
      collapsedRowsAtLeast: 1,
      openEpisodeListsAtLeast: 1
    },
    expectedSelectors: [
      '.library-root-dropzone[data-drop-type="root"]',
      '.cat-header[data-drag-type="folder"].collapsed',
      '.novel-item[data-drag-type="novel"] .novel-meta',
      '.ep-list.open .ep-item[data-drag-type="episode"].active'
    ]
  };
}

export function validateLibraryTreeRenderBrowserFixtureSample(root, sample = getLibraryTreeRenderBrowserFixtureSample(), contract = getLibraryTreeRenderFixtureDomSnapshotContract()) {
  const snapshot = validateLibraryTreeRenderFixtureDomSnapshot(root, contract);
  const scope = root?.querySelector ? root : null;
  if (!scope) return { pass: sample.pass, ok: false, reason: 'missing-root', snapshot };
  const count = selector => scope.querySelectorAll(selector).length;
  const counts = {
    rootDropZone: count('.library-root-dropzone[data-drop-type="root"]'),
    folderRows: count('.cat-header[data-drag-type="folder"]'),
    novelRows: count('.novel-item[data-drag-type="novel"]'),
    episodeRows: count('.ep-item[data-drag-type="episode"]'),
    activeRows: count('.novel-item.active,.ep-item.active'),
    collapsedRows: count('.cat-header.collapsed'),
    openEpisodeLists: count('.ep-list.open')
  };
  const expected = sample.expectedCounts || {};
  const failures = [];
  if (counts.rootDropZone !== (expected.rootDropZone || 1)) failures.push({ field: 'rootDropZone', expected: expected.rootDropZone || 1, actual: counts.rootDropZone });
  if (counts.folderRows < (expected.folderRowsAtLeast || 0)) failures.push({ field: 'folderRowsAtLeast', expected: expected.folderRowsAtLeast, actual: counts.folderRows });
  if (counts.novelRows < (expected.novelRowsAtLeast || 0)) failures.push({ field: 'novelRowsAtLeast', expected: expected.novelRowsAtLeast, actual: counts.novelRows });
  if (counts.episodeRows < (expected.episodeRowsAtLeast || 0)) failures.push({ field: 'episodeRowsAtLeast', expected: expected.episodeRowsAtLeast, actual: counts.episodeRows });
  if (counts.activeRows < (expected.activeRowsAtLeast || 0)) failures.push({ field: 'activeRowsAtLeast', expected: expected.activeRowsAtLeast, actual: counts.activeRows });
  if (counts.collapsedRows < (expected.collapsedRowsAtLeast || 0)) failures.push({ field: 'collapsedRowsAtLeast', expected: expected.collapsedRowsAtLeast, actual: counts.collapsedRows });
  if (counts.openEpisodeLists < (expected.openEpisodeListsAtLeast || 0)) failures.push({ field: 'openEpisodeListsAtLeast', expected: expected.openEpisodeListsAtLeast, actual: counts.openEpisodeLists });
  const missingSampleSelectors = (sample.expectedSelectors || []).filter(selector => !scope.querySelector(selector));
  return {
    pass: sample.pass,
    ok: snapshot.ok && failures.length === 0 && missingSampleSelectors.length === 0,
    snapshot,
    counts,
    failures,
    missingSampleSelectors,
    checkedAt: Date.now()
  };
}


export const LIBRARY_TREE_RENDER_FIXTURE_V295_PASS = 'v295-library-tree-render-fixture-validation-matrix-pass';

export function getLibraryTreeRenderBrowserValidationMatrix() {
  return {
    pass: LIBRARY_TREE_RENDER_FIXTURE_V295_PASS,
    purpose: 'Automated fixture-backed checklist replacing manual PC/mobile browser validation when an interactive browser run is unavailable.',
    modes: ['desktop-wide-library', 'mobile-library-overlay'],
    cases: [
      {
        id: 'nested-folder-collapsed',
        requiredSelectors: ['.cat-header[data-drag-type="folder"].collapsed', '.cat-header[data-drag-type="folder"] .folder-action-btn[data-type="folder"]']
      },
      {
        id: 'multi-file-active-episode',
        requiredSelectors: ['.ep-list.open .ep-item[data-drag-type="episode"].active', '.episode-action-btn[data-type="episode"]']
      },
      {
        id: 'novel-row-meta-progress',
        requiredSelectors: ['.novel-item[data-drag-type="novel"] .novel-meta', '.novel-item[data-drag-type="novel"] .progress-bar .progress-fill']
      },
      {
        id: 'root-dropzone-and-actions',
        requiredSelectors: ['.library-root-dropzone[data-drop-type="root"]', '.library-action-btn']
      }
    ],
    coverage: ['nested folder', 'multi-file', 'collapsed folder', 'active row', 'favorite/bookmark marker tolerance', 'action button wiring']
  };
}

export function validateLibraryTreeRenderBrowserValidationMatrix(root, matrix = getLibraryTreeRenderBrowserValidationMatrix()) {
  const scope = root?.querySelector ? root : null;
  if (!scope) return { pass: matrix.pass, ok: false, reason: 'missing-root', cases: [] };
  const cases = (matrix.cases || []).map(item => {
    const missingSelectors = (item.requiredSelectors || []).filter(selector => !scope.querySelector(selector));
    return {
      id: item.id,
      ok: missingSelectors.length === 0,
      missingSelectors
    };
  });
  return {
    pass: matrix.pass,
    ok: cases.every(item => item.ok),
    cases,
    modes: matrix.modes || [],
    coverage: matrix.coverage || [],
    checkedAt: Date.now()
  };
}
