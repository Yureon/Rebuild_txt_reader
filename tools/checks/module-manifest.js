const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FRONTEND_CHECK_MODULE_MANIFEST_PASS = 'v182-frontend-check-split-pass';
const FRONTEND_CHECK_MODULE_MANIFEST_GROUPING_PASS = 'v227-module-manifest-library-load-state-pass';

const REQUIRED_REBUILD_MODULES = [
  'main.mjs',
  'site.mjs',
  'mobile.mjs',
  'library-page.mjs',
  'metadata-page.mjs',
  'core/api.mjs',
  'core/storage.mjs',
  'core/utils.mjs',
  'core/app-shell.mjs',
  'core/feature-fragments.mjs',
  'core/performance-metrics.mjs',
  'state/app-state.mjs',
  'features/ui.mjs',
  'features/lazy-features.mjs',
  'features/ui/elements.mjs',
  'features/ui/viewport-fit.mjs',
  'features/library.mjs',
  'features/library-navigation-context.mjs',
  'features/library-shelf-filters.mjs',
  'features/library-paths.mjs',
  'features/library-current-selection.mjs',
  'features/library-render-options.mjs',
  'features/library-virtual-runtime-state.mjs',
  'features/library-virtual-diagnostics-summary.mjs',
  'features/library-virtual-diagnostics-formatters.mjs',
  'features/library-virtual-diagnostics-capture.mjs',
  'features/library-virtual-session-runtime.mjs',
  'features/library-virtual-trial-runtime.mjs',
  'features/library-prototype-rows.mjs',
  'features/library-tree-render-fixture.mjs',
  'features/library-virtual-rows-runtime.mjs',
  'features/library-tree-renderer.mjs',
  'features/library-full-renderer.mjs',
  'features/library-virtual-recording-runtime.mjs',
  'features/library-virtual-window-renderer.mjs',
  'features/library-action-orchestrator.mjs',
  'features/library-event-delegation.mjs',
  'features/library-navigation-actions.mjs',
  'features/library-favorites-runtime.mjs',
  'features/library-virtual-render-runtime.mjs',
  'features/library-virtual-render-scheduler.mjs',
  'features/library-empty-renderer.mjs',
  'features/library-app-api.mjs',
  'features/library-catalog-loader.mjs',
  'features/library-render-orchestrator.mjs',
  'features/library-install-controls-runtime.mjs',
  'features/library-runtime-dependency-bags.mjs',
  'features/library-runtime-config.mjs',
  'features/library-virtual-diagnostics-event.mjs',
  'features/library-navigation-bridge.mjs',
  'features/library-favorites-bridge.mjs',
  'features/library-event-delegation-bridge.mjs',
  'features/library-virtual-auto-fallback-reset.mjs',
  'features/library-action-orchestrator-bridge.mjs',
  'features/library-runtime-deps-bridge.mjs',
  'features/library-virtual-operations-bridge.mjs',
  'features/library-core-operations-bridge.mjs',
  'features/library-install-orchestrator.mjs',
  'features/library-scroll-anchor.mjs',
  'features/library-action-prompts.mjs',
  'features/library-mutation-actions.mjs',
  'features/library-quick-list.mjs',
  'features/library-quick-actions.mjs',
  'features/library-list-actions.mjs',
  'features/library-move-picker.mjs',
  'features/library-drag-drop-contract.mjs',
  'features/library-drag-drop.mjs',
  'features/library-mutation-formatters.mjs',
  'features/library-model.mjs',
  'features/library-load-state.mjs',
  'features/library-virtual-fallback-policy.mjs',
  'features/library-virtual-trial-diagnostics.mjs',
  'features/library-row-diagnostics.mjs',
  'features/library-virtual-row-inspection.mjs',
  'features/library-action-audit-summary.mjs',
  'features/library-action-audit-diagnostics.mjs',
  'features/library-action-audit-runtime.mjs',
  'features/library-virtual-gate-diagnostics.mjs',
  'features/library-prototype-diagnostics.mjs',
  'features/library-virtual-session-diagnostics.mjs',
  'features/library-virtual-history-record.mjs',
  'features/library-virtual-render-cache.mjs',
  'features/library-virtual-render-reporting.mjs',
  'features/library-virtual-gate-audit.mjs',
  'features/library-virtual-gate-detail.mjs',
  'features/library-virtual-session-payload.mjs',
  'features/library-virtual-session-fallback.mjs',
  'features/library-virtual-prototype-window-diagnostics.mjs',
  'features/reader.mjs',
  'features/reader/constants.mjs',
  'features/reader/cache-store.mjs',
  'features/reader/cache-diagnostics.mjs',
  'features/reader/cache-diagnostics-unavailable.mjs',
  'features/reader/cache-delete-formatters.mjs',
  'features/reader/cache-record-formatters.mjs',
  'features/reader/cache-novel-stats.mjs',
  'features/reader/cache-prune-plan.mjs',
  'features/reader/cache-prune-diagnostics.mjs',
  'features/reader/coordinates.mjs',
  'features/reader/chunk-window.mjs',
  'features/reader/chunk-window-diagnostics.mjs',
  'features/reader/chunk-window-scroll-budget.mjs',
  'features/reader/chunk-window-prune.mjs',
  'features/reader/dom-actions.mjs',
  'features/reader/jump-panel.mjs',
  'features/reader/offline-status.mjs',
  'features/reader/offline-status-formatters.mjs',
  'features/reader/prefetch-queue.mjs',
  'features/reader/prefetch-snapshot.mjs',
  'features/reader/prefetch-schedule.mjs',
  'features/reader/progress.mjs',
  'features/reader/text-blocks.mjs',
  'features/reader/chunk-headings.mjs',
  'features/reader/scroll-side-effects.mjs',
  'features/reader/load-chunk-side-effects.mjs',
  'features/reader/failure-reporting.mjs',
  'features/reader/request-guards.mjs',
  'features/reader/navigation-intent.mjs',
  'features/reader/open-state.mjs',
  'features/reader/virtual-layout.mjs',
  'features/reader/virtual-render-stability.mjs',
  'features/reader/virtual-window-range-stability.mjs',
  'features/reader/virtual-scroll-stability.mjs',
  'features/reader/virtual-layout-diagnostics.mjs',
  'features/reader/manual-diagnostics-snapshot.mjs',
  'features/reader/manual-diagnostics-storage.mjs',
  'features/settings/manual-diagnostics-controls.mjs',
  'features/reader/virtual-layout-report-labels.mjs',
  'features/reader/virtual-row-signature.mjs',
  'features/search.mjs',
  'features/search/matcher.mjs',
  'features/search/results-view.mjs',
  'features/search/status-panel.mjs',
  'features/search/status-formatters.mjs',
  'features/search/coverage-summary.mjs',
  'features/search/remocon-ui.mjs',
  'features/search/status-detail-rows.mjs',
  'features/search/filter-controls.mjs',
  'features/search/jump-status.mjs',
  'features/search/live-dom-diagnostics-snapshot.mjs',
  'features/search/retry-dispatcher.mjs',
  'features/search/announcement-formatters.mjs',
  'features/search/navigation-ui.mjs',
  'features/search/session-reset.mjs',
  'features/search/session-runtime.mjs',
  'features/search/run-actions.mjs',
  'features/search/retry-actions.mjs',
  'features/search/jump-info.mjs',
  'features/search/result-labels.mjs',
  'features/search/filter-summary.mjs',
  'features/bookmarks.mjs',
  'features/bookmarks/bookmark-view.mjs',
  'features/bookmarks/model.mjs',
  'features/bookmarks/read-data-modal.mjs',
  'features/bookmarks/read-data-model.mjs',
  'features/bookmarks/read-data-import.mjs',
  'features/bookmarks/read-data-import-constants.mjs',
  'features/bookmarks/read-data-import-merge.mjs',
  'features/bookmarks/read-data-import-progress-merge.mjs',
  'features/bookmarks/read-data-import-array-merge.mjs',
  'features/bookmarks/read-data-import-detail-builders.mjs',
  'features/bookmarks/read-data-import-diff-export.mjs',
  'features/bookmarks/read-data-preview.mjs',
  'features/bookmarks/read-data-preview-filter.mjs',
  'features/bookmarks/read-data-preview-entries.mjs',
  'features/bookmarks/read-data-preview-bulk-toolbar.mjs',
  'features/bookmarks/read-data-preview-results.mjs',
  'features/bookmarks/read-data-preview-detail-modal.mjs',
  'features/bookmarks/read-data-rollback.mjs',
  'features/theme-settings.mjs',
  'features/settings/appearance.mjs',
  'features/settings/data-tools.mjs',
  'features/settings/custom-css.mjs',
  'features/settings/custom-css-utils.mjs',
  'features/settings/controls.mjs',
  'features/settings/functional-labels.mjs',
  'features/settings/functional-runtime.mjs',
  'features/settings/control-dom-utils.mjs',
  'features/settings/tab-switching.mjs',
  'features/settings/clock-format.mjs',
  'features/settings/safe-area-controls.mjs',
  'features/settings/safe-area-constants.mjs',
  'features/settings/safe-area-labels.mjs',
  'features/settings/safe-area-profiles.mjs',
  'features/settings/safe-area-profile-actions.mjs',
  'features/settings/safe-area-profile-labels.mjs',
  'features/settings/safe-area-profile-prompt.mjs',
  'features/settings/safe-area-context-labels.mjs',
  'features/settings/safe-area-template-factory.mjs',
  'features/settings/safe-area-template-labels.mjs',
  'features/settings/safe-area-context.mjs',
  'features/settings/safe-area-debug.mjs',
  'features/settings/safe-area-debug-formatters.mjs',
  'features/settings/safe-area-slot-layout.mjs',
  'features/settings/library-virtual-status.mjs',
  'features/settings/shortcuts.mjs',
  'features/settings/font-resources.mjs',
  'features/settings/fonts.mjs',
  'features/settings/font-choice-card.mjs',
  'features/settings/preprocess.mjs',
  'features/settings/preprocess-summary.mjs',
  'features/settings/theme-editor.mjs',
  'features/settings/theme-color-utils.mjs',
  'features/settings/theme-file-utils.mjs',
  'features/settings/theme-presets.mjs',
  'features/sync-devtools.mjs',
  'features/devtools/report.mjs',
  'features/devtools/report-formatters.mjs',
  'features/recovery/search-diagnostics.mjs',
  'features/recovery/cache-diagnostics.mjs',
  'features/recovery/export-utils.mjs',
  'features/recovery/button-wiring.mjs',
  'features/recovery/sync-devtools-bridges.mjs',
  'features/recovery/runtime.mjs',
  'features/recovery/orchestration.mjs',
  'features/recovery/summary-panel.mjs',
  'features/recovery/policy-checklist-panel.mjs',
  'features/recovery/import-scope-panel.mjs',
  'features/recovery/import-actions.mjs',
  'features/recovery/import-writeback.mjs',
  'features/recovery/navigation.mjs',
  'features/recovery/action-ui.mjs',
  'features/recovery/dom-smoke-panel.mjs',
  'features/recovery/dom-smoke-markers.mjs',
  'features/recovery/dom-smoke-panel-renderer.mjs',
  'features/recovery/diagnostics-panel.mjs',
  'features/recovery/cache-management-panel.mjs',
  'features/recovery/cache-management-panel-actions.mjs',
  'features/recovery/search-panel.mjs',
  'features/recovery/search-panel-actions.mjs',
  'features/recovery/search-panel-renderers.mjs',
  'features/recovery/action-button-layout.mjs',
  'features/recovery/cache-actions.mjs',
  'features/recovery/search-actions.mjs',
  'features/recovery/search-diagnostics-copy-payload.mjs',
  'features/recovery/search-coverage-modal-actions.mjs',
  'features/recovery/search-coverage-modal-renderers.mjs',
  'features/recovery/modal-layer.mjs',
  'features/recovery/snapshot-export.mjs',
  'features/recovery/local-maintenance-actions.mjs',
  'features/sync/sync-formatters.mjs',
  'features/sync/device-management.mjs',
  'features/sync/remote-resume.mjs',
  'features/sync/periodic-device-sync.mjs',
  'features/sync/server-state-hydration.mjs',
  'features/devtools/controls.mjs'
];

function getRequiredRebuildModuleGroups(modules = REQUIRED_REBUILD_MODULES) {
  const groups = new Map();
  for (const rel of modules) {
    const parts = String(rel).split('/');
    const group = parts[0] === 'features' && parts[1] ? 'features/' + parts[1] : parts[0] || 'root';
    groups.set(group, (groups.get(group) || 0) + 1);
  }
  return Array.from(groups.entries()).map(([group, count]) => ({ group, count }));
}

function readRequiredRebuildModule(root, rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error('Missing rebuild module: ' + rel);
  return fs.readFileSync(full, 'utf8');
}

function probeModuleSyntax(rel, source) {
  // Basic parse check: strip ESM import/export keywords enough for vm to catch gross syntax errors.
  const parseProbe = source
    .replace(/^\s*export\s+\{[^;]+from\s+['"][^'"]+['"];\s*$/mg, '')
    .replace(/^\s*export\s+\*\s+from\s+['"][^'"]+['"];\s*$/mg, '')
    .replace(/^\s*import\s+[^;]+;\s*$/mg, '')
    .replace(/\bexport\s+(?=(async\s+)?function|const|let|var|class)/g, '')
    .replace(/\bexport\s*\{[^}]+\};?/g, '');
  try {
    new vm.Script(parseProbe, { filename: rel });
  } catch (error) {
    throw new Error('Syntax probe failed for ' + rel + '\n' + (error && error.stack || error));
  }
}

function runModuleManifestChecks({ root, projectRoot }) {
  if (!root) throw new Error('runModuleManifestChecks requires root');
  const publicRoot = path.join(projectRoot || path.join(root, '..', '..', '..'), 'public');

  for (const rel of REQUIRED_REBUILD_MODULES) {
    const source = readRequiredRebuildModule(root, rel);
    probeModuleSyntax(rel, source);
  }

  for (const entry of ['site.mjs', 'mobile.mjs', 'library-page.mjs']) {
    const source = fs.readFileSync(path.join(root, entry), 'utf8');
    if (!source.includes('./core/app-shell.mjs') || !source.includes('./main.mjs')) {
      throw new Error(entry + ' does not import the expected boot modules');
    }
  }

  const mainSource = fs.readFileSync(path.join(root, 'main.mjs'), 'utf8');
  if (!/export\s+(?:async\s+)?function\s+boot\s*\(/.test(mainSource)) {
    throw new Error('main.mjs must export boot');
  }

  for (const page of ['index.html', 'library.html', 'metadata.html', 'site.html', 'mobile.html', 'fragments/app-shell.html', 'fragments/library-shell.html', 'fragments/deferred-ui.html']) {
    const full = path.join(publicRoot, page);
    if (!fs.existsSync(full)) throw new Error('Missing page: public/' + page);
  }

  return { pass: FRONTEND_CHECK_MODULE_MANIFEST_PASS, groupingPass: FRONTEND_CHECK_MODULE_MANIFEST_GROUPING_PASS, requiredCount: REQUIRED_REBUILD_MODULES.length, groups: getRequiredRebuildModuleGroups(REQUIRED_REBUILD_MODULES) };
}

module.exports = {
  FRONTEND_CHECK_MODULE_MANIFEST_PASS,
  FRONTEND_CHECK_MODULE_MANIFEST_GROUPING_PASS,
  REQUIRED_REBUILD_MODULES,
  getRequiredRebuildModuleGroups,
  runModuleManifestChecks
};
