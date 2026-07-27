export const LIBRARY_HEADER_SCROLL_REVEAL_PASS = 'v653-library-header-scroll-reveal-pass';

function finiteTop(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function createLibraryHeaderScrollState(options = {}) {
  const revealDelta = Math.max(1, Number(options.revealDelta) || 4);
  const compactDelta = Math.max(1, Number(options.compactDelta) || 6);
  const compactTop = Math.max(24, Number(options.compactTop) || 72);
  const topReveal = Math.max(0, Math.min(compactTop, Number(options.topReveal) || 28));
  const revealHoldMs = Math.max(0, Number(options.revealHoldMs) || 700);
  let lastTop = finiteTop(options.initialTop);
  let compact = options.initialCompact === true;
  let revealHoldUntil = 0;

  const reset = (top = 0, nextCompact = false) => {
    lastTop = finiteTop(top);
    compact = nextCompact === true && lastTop > topReveal;
    revealHoldUntil = 0;
    return { compact, changed:false, top:lastTop, delta:0, pass:LIBRARY_HEADER_SCROLL_REVEAL_PASS };
  };

  const reveal = (topValue = lastTop, nowValue = Date.now()) => {
    const top = finiteTop(topValue);
    const now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
    const previous = compact;
    compact = false;
    lastTop = top;
    revealHoldUntil = now + revealHoldMs;
    return { compact, changed:compact !== previous, top, delta:0, revealHoldUntil, pass:LIBRARY_HEADER_SCROLL_REVEAL_PASS };
  };

  const update = (topValue, nowValue = Date.now()) => {
    const top = finiteTop(topValue);
    const now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
    const delta = top - lastTop;
    const previous = compact;

    if (top <= topReveal) {
      compact = false;
      revealHoldUntil = Math.max(revealHoldUntil, now + revealHoldMs);
    } else if (delta <= -revealDelta) {
      // Any deliberate upward movement reveals the command row. The hold prevents
      // the header's own expansion from immediately producing a compensating
      // downward scroll event that would hide it again on mobile browsers.
      compact = false;
      revealHoldUntil = now + revealHoldMs;
    } else if (delta >= compactDelta && top >= compactTop && now >= revealHoldUntil) {
      compact = true;
    }

    lastTop = top;
    return {
      compact,
      changed:compact !== previous,
      top,
      delta,
      revealHoldUntil,
      pass:LIBRARY_HEADER_SCROLL_REVEAL_PASS
    };
  };

  return { update, reset, reveal, get compact(){ return compact; }, get lastTop(){ return lastTop; } };
}

export function applyLibraryHeaderCompactState(body, result) {
  if (!body?.classList || !result) return false;
  if (result.changed === false && body.classList.contains('library-header-compact') === result.compact) return false;
  body.classList.toggle('library-header-compact', result.compact === true);
  body.dataset.libraryHeaderScrollPass = LIBRARY_HEADER_SCROLL_REVEAL_PASS;
  return true;
}
