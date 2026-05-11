(function () {
  'use strict';

  const SEARCH_RESULT_FIELD_VALIDATION_PASS = 'v151-search-result-field-validation-pass';
  const SEARCH_WORKER_CLIENT_PASS = 'v399-search-worker-client-pass';
  const SEARCH_WORKER_BATCH_SIZE_TUNE_PASS = 'v509-search-worker-adaptive-batch-pass';
  const MAX_MATCHES_PER_CHUNK = 80;

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeChunkPayload(chunk) {
    const chunkNumber = Math.max(1, Math.round(Number(chunk && chunk.chunk) || 1));
    const totalChunks = Math.max(1, Number(chunk && chunk.totalChunks) || chunkNumber);
    return {
      chunk: chunkNumber,
      totalChunks,
      novelId: String((chunk && chunk.novelId) || ''),
      episodeId: Object.prototype.hasOwnProperty.call(chunk || {}, 'episodeId') ? chunk.episodeId : null,
      episodeTitle: String((chunk && chunk.episodeTitle) || ''),
      episodeIndex: Math.max(0, Math.round(Number(chunk && chunk.episodeIndex) || 0)),
      episodeCount: Math.max(1, Math.round(Number(chunk && chunk.episodeCount) || 1)),
      title: String((chunk && chunk.title) || ''),
      source: String((chunk && (chunk.__searchSource || chunk.source)) || ''),
      content: String((chunk && chunk.content) || '')
    };
  }

  function collectWorkerMatches(chunks, query, limit) {
    const q = String(query || '');
    const maxResults = Math.max(0, Math.round(Number(limit) || 0));
    if (!q || maxResults <= 0) return [];
    const re = new RegExp(escapeRegExp(q), 'gi');
    const out = [];
    for (const item of Array.isArray(chunks) ? chunks : []) {
      if (out.length >= maxResults) break;
      const chunk = normalizeChunkPayload(item);
      const text = chunk.content;
      let match;
      let count = 0;
      re.lastIndex = 0;
      while ((match = re.exec(text)) && count < MAX_MATCHES_PER_CHUNK && out.length < maxResults) {
        const idx = Math.max(0, Number(match.index) || 0);
        const start = Math.max(0, idx - 70);
        const end = Math.min(text.length, idx + q.length + 90);
        out.push({
          novelId: chunk.novelId,
          episodeId: chunk.episodeId,
          episodeTitle: chunk.episodeTitle,
          episodeIndex: chunk.episodeIndex,
          episodeCount: chunk.episodeCount,
          chunk: chunk.chunk,
          totalChunks: chunk.totalChunks,
          index: idx,
          title: chunk.title,
          excerpt: text.slice(start, end),
          query: q,
          matchLength: q.length,
          source: chunk.source,
          textLength: text.length,
          resultFieldValidationPass: SEARCH_RESULT_FIELD_VALIDATION_PASS,
          searchWorkerClientPass: SEARCH_WORKER_CLIENT_PASS
        });
        count += 1;
        if (match.index === re.lastIndex) re.lastIndex += 1;
      }
    }
    return out;
  }

  self.onmessage = function onSearchWorkerMessage(event) {
    const message = event && event.data ? event.data : {};
    if (message.type !== 'match') return;
    const id = message.id;
    try {
      const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const results = collectWorkerMatches(message.chunks, message.query, message.limit);
      const elapsedMs = Math.max(0, ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startedAt);
      self.postMessage({ id, type: 'result', ok: true, pass: SEARCH_WORKER_CLIENT_PASS, batchSizeTunePass: SEARCH_WORKER_BATCH_SIZE_TUNE_PASS, elapsedMs, results });
    } catch (error) {
      self.postMessage({ id, type: 'result', ok: false, pass: SEARCH_WORKER_CLIENT_PASS, error: error && (error.stack || error.message || String(error)) });
    }
  };
}());
