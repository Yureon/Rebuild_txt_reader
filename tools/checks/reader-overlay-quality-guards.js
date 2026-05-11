const FRONTEND_CHECK_READER_OVERLAY_QUALITY_GUARDS_PASS = 'v190-frontend-check-reader-overlay-quality-guards-pass';

function runReaderOverlayQualityGuardChecks(ctx) {
  const {
    shellSource,
    appCssSource,
    searchResultsSource,
    uiSource
  } = ctx;

  ['data-reader-overlay-pass="v140"','data-reader-overlay-role="search-remocon"','data-reader-overlay-role="bottom-nav"','data-reader-overlay-role="chunk-jumper-panel"','aria-label="검색 결과 이동 리모컨"'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v140 reader overlay shell marker: ${marker}`);
  });
  ['v119 Reader overlay / remocon z-index review','--z-reader-search-remocon','search-remocon-open','body.modal-layer-open #search-nav-remote[data-reader-overlay-pass].open','#chunk-jumper-panel[data-reader-overlay-pass]'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v140 reader overlay CSS marker: ${marker}`);
  });
  ['SEARCH_REMOCON_OVERLAY_PASS','search-remocon-open','readerOverlayState'].forEach((marker) => {
    if (!searchResultsSource.includes(marker)) throw new Error(`Missing v140 search remocon runtime marker: ${marker}`);
  });
  ['READER_OVERLAY_PASS','markReaderOverlayNode','status-pill-'].forEach((marker) => {
    if (!uiSource.includes(marker)) throw new Error(`Missing v140 status overlay runtime marker: ${marker}`);
  });
}

module.exports = {
  FRONTEND_CHECK_READER_OVERLAY_QUALITY_GUARDS_PASS,
  runReaderOverlayQualityGuardChecks
};
