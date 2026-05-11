const { requireCurrentVersionAndNoStaleMarkers } = require('./check-utils.js');
const FRONTEND_CHECK_VERSION_MARKERS_PASS = 'v182-frontend-check-split-pass';

const DEFAULT_STALE_REBUILD_MARKERS = [
  'rebuild-v221',
  'rebuild-v220',
  'rebuild-v219',
  'rebuild-v218',
  'rebuild-v217',
  'rebuild-v216',
  'rebuild-v215',
  'rebuild-v214',
  'rebuild-v215',
  'rebuild-v213',
  'rebuild-v212',
  'rebuild-v211',
  'rebuild-v210',
  'rebuild-v209',
  'rebuild-v208',
  'rebuild-v207',
  'rebuild-v206',
  'rebuild-v205',
  'rebuild-v204',
  'rebuild-v203',
  'rebuild-v202',
  'rebuild-v201',
  'rebuild-v200',
  'rebuild-v199',
  'rebuild-v198',
  'rebuild-v197',
  'rebuild-v196',
  'rebuild-v195',
  'rebuild-v194',
  'rebuild-v193',
  'rebuild-v192',
  'rebuild-v191',
  'rebuild-v190',
  'rebuild-v189',
  'rebuild-v188',
  'rebuild-v187',
  'rebuild-v186','rebuild-v185','rebuild-v184','rebuild-v183','rebuild-v182','rebuild-v181','rebuild-v180','rebuild-v179','rebuild-v178','rebuild-v177','rebuild-v176','rebuild-v175',
  'rebuild-v174','rebuild-v173','rebuild-v172','rebuild-v171','rebuild-v170','rebuild-v169','rebuild-v168',
  'rebuild-v167','rebuild-v166','rebuild-v165','rebuild-v164','rebuild-v163','rebuild-v162','rebuild-v161',
  'rebuild-v160','rebuild-v159','rebuild-v158','rebuild-v157','rebuild-v156','rebuild-v155','rebuild-v154',
  'rebuild-v153','rebuild-v152','rebuild-v151','rebuild-v150','rebuild-v149','rebuild-v148','rebuild-v147',
  'rebuild-v146','rebuild-v145','rebuild-v144','rebuild-v143','rebuild-v142','rebuild-v141','rebuild-v140',
  'rebuild-v139','rebuild-v138','rebuild-v137','rebuild-v136','rebuild-v135','rebuild-v134','rebuild-v133'
];

function runVersionMarkerChecks({ currentVersion, currentVersionSources, devtoolsSource, staleMarkers = DEFAULT_STALE_REBUILD_MARKERS }) {
  if (!currentVersion) throw new Error('runVersionMarkerChecks requires currentVersion');
  if (!Array.isArray(currentVersionSources)) throw new Error('runVersionMarkerChecks requires currentVersionSources');
  for (const [label, source] of currentVersionSources) {
    requireCurrentVersionAndNoStaleMarkers(source, currentVersion, staleMarkers, label);
  }
  if (!devtoolsSource.includes(currentVersion)) throw new Error('sync-devtools.mjs is not marked ' + currentVersion);
  return { pass: FRONTEND_CHECK_VERSION_MARKERS_PASS, currentVersion };
}

module.exports = {
  FRONTEND_CHECK_VERSION_MARKERS_PASS,
  DEFAULT_STALE_REBUILD_MARKERS,
  runVersionMarkerChecks
};
