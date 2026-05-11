const OWNER_STYLE_ID = 'owner-tools-css';
const OWNER_STYLE_HREF = '/styles/owner.css?v=rebuild-v564';
export const OWNER_CSS_SPLIT_PASS = 'v503-owner-css-split-pass';

let ownerStyleLoadPromise = null;

export function ensureOwnerStylesLoaded(doc = document) {
  if (!doc?.head) return Promise.resolve(false);
  const existing = doc.getElementById(OWNER_STYLE_ID);
  if (existing) return Promise.resolve(true);
  if (ownerStyleLoadPromise) return ownerStyleLoadPromise;
  ownerStyleLoadPromise = new Promise(resolve => {
    const link = doc.createElement('link');
    link.id = OWNER_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = OWNER_STYLE_HREF;
    link.dataset.ownerCssSplitPass = OWNER_CSS_SPLIT_PASS;
    link.onload = () => resolve(true);
    link.onerror = () => resolve(false);
    doc.head.appendChild(link);
  });
  return ownerStyleLoadPromise;
}
