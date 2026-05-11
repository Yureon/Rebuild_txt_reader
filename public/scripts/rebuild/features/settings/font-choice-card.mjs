import { createEl } from '../../core/utils.mjs';
import {
  displayFontName,
  ensureFontStylesheetForFamily,
  isDeviceFontOverrideActive,
  normalizeFontFamilyValue,
  resolveActiveFontFamily,
  resolveDeviceFontFamily,
  resolveSharedFontFamily
} from './font-resources.mjs';

export const SETTINGS_FONT_CHOICE_CARD_HELPER_PASS = 'v212-settings-font-choice-card-helper-pass';
export const SETTINGS_ACCOUNT_FONT_LABELS_PASS = 'v427-settings-account-font-labels-pass';

export function createFontChoiceCard(app, options = {}) {
  const prefs = app.state.prefs || {};
  const value = normalizeFontFamilyValue(options.value, options.defaultFont || 'var(--font-rd)');
  const sharedActive = resolveSharedFontFamily(prefs) === value;
  const deviceActive = resolveDeviceFontFamily(prefs) === value;
  const active = resolveActiveFontFamily(prefs) === value;
  const classes = ['font-choice-card'];
  if (active) classes.push('active');
  if (sharedActive) classes.push('shared-active');
  if (deviceActive) classes.push('device-active');

  const title = createEl('div', { class: 'font-choice-title', text: options.name || displayFontName(value) });
  const badges = createEl('div', { class: 'font-choice-badges' }, [
    sharedActive ? createEl('span', { class: 'font-badge shared', text: '계정' }) : null,
    deviceActive ? createEl('span', { class: 'font-badge device', text: '이 기기' }) : null
  ]);
  const top = createEl('div', { class: 'font-choice-top' }, [title, badges]);
  const meta = createEl('div', { class: 'font-choice-meta', text: options.meta || '' });
  const sample = createEl('div', { class: 'font-choice-sample', text: options.sample || '가나다라마바사 The quick brown fox.' });
  sample.style.fontFamily = value;
  ensureFontStylesheetForFamily(value);

  const actions = createEl('div', { class: 'font-choice-actions' }, [
    createEl('button', {
      class: sharedActive && !isDeviceFontOverrideActive(prefs) ? 'font-choice-action primary' : 'font-choice-action',
      type: 'button',
      text: sharedActive ? '계정 적용됨' : '내 계정 적용',
      onclick: options.onApplyShared
    }),
    createEl('button', {
      class: deviceActive ? 'font-choice-action primary' : 'font-choice-action',
      type: 'button',
      text: deviceActive ? '기기 적용됨' : '이 기기 적용',
      onclick: options.onApplyDevice
    }),
    options.custom ? createEl('button', {
      class: 'font-choice-action danger',
      type: 'button',
      text: '삭제',
      onclick: options.onDelete
    }) : null
  ]);

  return createEl('div', { class: classes.join(' '), dataset: { fontValue: value } }, [top, meta, sample, actions]);
}
