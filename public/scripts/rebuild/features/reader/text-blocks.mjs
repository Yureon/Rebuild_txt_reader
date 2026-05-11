const MAX_BLOCK_CHARS = 1200;
const MIN_BLOCK_CHARS = 420;

export function splitContentBlocks(content) {
  const text = String(content || '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return [{ index: 0, start: 0, end: 0, text: '(빈 블럭)' }];
  const blocks = [];
  const re = /\n{2,}/g;
  let last = 0;
  let match;
  let blockIndex = 0;
  const pushParagraph = (paragraph, offset) => {
    if (!paragraph.trim()) return;
    let pos = 0;
    while (pos < paragraph.length) {
      const remaining = paragraph.length - pos;
      let cut = remaining <= MAX_BLOCK_CHARS ? remaining : findSplitPoint(paragraph, pos, Math.min(paragraph.length, pos + MAX_BLOCK_CHARS));
      if (cut < MIN_BLOCK_CHARS && remaining > MAX_BLOCK_CHARS) cut = Math.min(MAX_BLOCK_CHARS, remaining);
      const part = paragraph.slice(pos, pos + cut);
      blocks.push({ index: blockIndex++, start: offset + pos, end: offset + pos + part.length, text: part });
      pos += cut;
      while (paragraph[pos] === '\n') pos += 1;
    }
  };
  while ((match = re.exec(text))) {
    pushParagraph(text.slice(last, match.index), last);
    last = re.lastIndex;
  }
  pushParagraph(text.slice(last), last);
  return blocks.length ? blocks : [{ index: 0, start: 0, end: text.length, text }];
}

function findSplitPoint(text, start, hardEnd) {
  const slice = text.slice(start, hardEnd);
  const candidates = ['\n', '다.', '요.', '까.', '죠.', '!”', '!"', '?"', '. ', '! ', '? ', ' '];
  let best = -1;
  for (const token of candidates) {
    const idx = slice.lastIndexOf(token);
    if (idx > best) best = idx + token.length;
    if (best >= MIN_BLOCK_CHARS) break;
  }
  return best >= MIN_BLOCK_CHARS ? best : hardEnd - start;
}
