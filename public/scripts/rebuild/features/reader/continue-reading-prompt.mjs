export const CONTINUE_READING_PROMPT_PASS = 'v664-library-continue-reading-prompt-pass';

function clamp01(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

export function hasResumableProgress(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (clamp01(snapshot.documentRatio ?? snapshot.episodeDocumentRatio ?? snapshot.ratio) >= 0.002) return true;
  return (Number(snapshot.chunk) || 1) > 1
    || (Number(snapshot.globalBlockIndex) || 0) > 0
    || (Number(snapshot.blockIndex) || 0) > 0
    || (Number(snapshot.charIndex) || 0) > 0;
}

export function buildContinueReadingPromptCopy(novel, snapshot) {
  const novelTitle = String(novel?.title || novel?.fileName || '제목 없는 작품').trim() || '제목 없는 작품';
  const episodeId = String(snapshot?.episodeId || '');
  const episode = Array.isArray(novel?.episodes)
    ? novel.episodes.find(item => String(item?.id || '') === episodeId)
    : null;
  const episodeTitle = String(episode?.title || episode?.fileName || snapshot?.episodeTitle || '').trim();
  const ratio = clamp01(snapshot?.documentRatio ?? snapshot?.episodeDocumentRatio ?? snapshot?.ratio);
  const percent = Math.round(ratio * 1000) / 10;
  const location = episodeTitle || ((Number(snapshot?.chunk) || 1) > 1 ? `${Number(snapshot.chunk).toLocaleString('ko-KR')}번째 구간` : '저장된 위치');
  return {
    title: `${novelTitle} 이어보기`,
    meta: `${location} · 진행 ${percent.toLocaleString('ko-KR')}%`,
    novelTitle,
    episodeTitle,
    percent
  };
}

export function promptContinueReading(app, novel, snapshot, options = {}) {
  const bar = app?.els?.continueReadingBar;
  const title = app?.els?.continueReadingTitle;
  const meta = app?.els?.continueReadingMeta;
  const restart = app?.els?.continueReadingRestart;
  const resume = app?.els?.continueReadingResume;
  if (!bar || !title || !meta || !restart || !resume || !hasResumableProgress(snapshot)) {
    return Promise.resolve('resume');
  }
  const copy = buildContinueReadingPromptCopy(novel, snapshot);
  title.textContent = copy.title;
  meta.textContent = copy.meta;
  bar.dataset.novelId = String(novel?.id || '');
  bar.dataset.continueReadingPass = CONTINUE_READING_PROMPT_PASS;
  bar.setAttribute('aria-hidden', 'false');
  bar.classList.add('open');

  return new Promise(resolve => {
    let settled = false;
    const cleanup = choice => {
      if (settled) return;
      settled = true;
      restart.removeEventListener('click', onRestart);
      resume.removeEventListener('click', onResume);
      document.removeEventListener('keydown', onKeyDown, true);
      bar.classList.remove('open');
      bar.setAttribute('aria-hidden', 'true');
      delete bar.dataset.novelId;
      resolve(choice);
    };
    const onRestart = () => cleanup('restart');
    const onResume = () => cleanup('resume');
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(options.escapeChoice === 'restart' ? 'restart' : 'resume');
      }
    };
    restart.addEventListener('click', onRestart, { once:true });
    resume.addEventListener('click', onResume, { once:true });
    document.addEventListener('keydown', onKeyDown, true);
    queueMicrotask(() => resume.focus?.());
  });
}
