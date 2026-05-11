export function setChecked(el, value) { if (el) el.checked = !!value; }
export function setValue(el, value) { if (el && 'value' in el) el.value = value == null ? '' : String(value); }
export function setText(el, value) { if (el) el.textContent = value == null ? '' : String(value); }
export function setActive(el, value) { if (el) el.classList.toggle('active', !!value); }
export function toggleCollapsed(el, collapsed) { if (el) el.classList.toggle('collapsed', !!collapsed); }
export function setHidden(el, hidden) {
  if (!el) return;
  const shouldHide = !!hidden;
  el.hidden = shouldHide;
  el.classList?.toggle?.('collapsed', shouldHide);
  el.setAttribute?.('aria-hidden', shouldHide ? 'true' : 'false');
  if (el.style && 'display' in el.style) el.style.display = shouldHide ? 'none' : '';
}
export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
}

