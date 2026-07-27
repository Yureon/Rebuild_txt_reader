(function () {
  'use strict';

  var GUARD_VERSION = 'v667';
  var AUTOFILL_ANIMATION = 'txt-reader-nonauth-autofill-start';
  var CONTROL_SELECTOR = [
    'input:not([type])',
    'input[type="text"]',
    'input[type="search"]',
    'input[type="email"]',
    'input[type="url"]',
    'input[type="tel"]',
    'input[type="password"]',
    'textarea',
    '[contenteditable="true"]'
  ].join(',');
  var READONLY_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel']);
  var IGNORE_ATTRIBUTES = Object.freeze({
    'data-form-type': 'other',
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
    'data-protonpass-ignore': 'true',
    'data-keeper-ignore': 'true'
  });
  var generatedNameSerial = 0;

  function isElement(node) {
    return !!node && node.nodeType === 1;
  }

  function isCredentialAllowed(element) {
    if (!isElement(element)) return false;
    if (element.getAttribute('data-credential-autofill') === 'allow') return true;
    return !!(typeof element.closest === 'function' && element.closest('[data-autofill-scope="credentials"]'));
  }

  function isGuardableControl(element) {
    if (!isElement(element) || typeof element.matches !== 'function') return false;
    return element.matches(CONTROL_SELECTOR) && !isCredentialAllowed(element) && element.getAttribute('data-autofill-preserve') !== 'true';
  }

  function setAttributeIfChanged(element, name, value) {
    if (element.getAttribute(name) === value) return false;
    element.setAttribute(name, value);
    return true;
  }

  function applyIgnoreAttributes(element) {
    Object.keys(IGNORE_ATTRIBUTES).forEach(function (name) {
      setAttributeIfChanged(element, name, IGNORE_ATTRIBUTES[name]);
    });
    setAttributeIfChanged(element, 'data-autofill-guard', GUARD_VERSION);
    setAttributeIfChanged(element, 'aria-autocomplete', 'none');
  }

  function giveNeutralName(element) {
    if (!element || (typeof element.hasAttribute === 'function' ? element.hasAttribute('name') : element.getAttribute('name') != null) || element.tagName === 'TEXTAREA') return;
    generatedNameSerial += 1;
    element.setAttribute('name', 'txt-reader-nonauth-field-' + generatedNameSerial.toString(36));
    element.setAttribute('data-autofill-neutral-name', GUARD_VERSION);
  }

  function armReadonly(element) {
    if (!element || element.tagName !== 'INPUT') return false;
    var type = String(element.getAttribute('type') || element.type || '').toLowerCase();
    if (!READONLY_TYPES.has(type) || element.disabled || element.readOnly || element.getAttribute('data-autofill-user-edited') === 'true') return false;
    element.readOnly = true;
    element.setAttribute('readonly', '');
    element.setAttribute('data-autofill-readonly-lock', GUARD_VERSION);
    element.setAttribute('data-autofill-armed-value', String(element.value || ''));
    return true;
  }

  function unlockControl(element) {
    if (!isElement(element)) return false;
    if (element.getAttribute('data-autofill-readonly-lock') !== GUARD_VERSION) return false;
    element.removeAttribute('data-autofill-readonly-lock');
    element.removeAttribute('readonly');
    element.readOnly = false;
    return true;
  }

  function releaseGuard(element) {
    if (!isElement(element)) return false;
    unlockControl(element);
    Object.keys(IGNORE_ATTRIBUTES).forEach(function (name) { element.removeAttribute(name); });
    element.removeAttribute('data-autofill-guard');
    element.removeAttribute('data-autofill-user-edited');
    element.removeAttribute('data-autofill-armed-value');
    element.removeAttribute('aria-autocomplete');
    return true;
  }

  function guardControl(element) {
    if (!isElement(element) || typeof element.matches !== 'function' || !element.matches(CONTROL_SELECTOR)) return false;
    if (isCredentialAllowed(element) || element.getAttribute('data-autofill-preserve') === 'true') { releaseGuard(element); return false; }
    setAttributeIfChanged(element, 'autocomplete', 'off');
    applyIgnoreAttributes(element);
    giveNeutralName(element);
    if (String(element.getAttribute('type') || '').toLowerCase() === 'search') {
      setAttributeIfChanged(element, 'role', 'searchbox');
      setAttributeIfChanged(element, 'inputmode', 'search');
    }
    armReadonly(element);
    return true;
  }

  function guardForm(form) {
    if (!isElement(form) || form.tagName !== 'FORM') return false;
    if (form.getAttribute('data-autofill-scope') === 'credentials') { releaseGuard(form); return false; }
    setAttributeIfChanged(form, 'autocomplete', 'off');
    applyIgnoreAttributes(form);
    return true;
  }

  function guardTree(root) {
    if (!root) return 0;
    var guarded = 0;
    if (isElement(root)) {
      if (root.tagName === 'FORM' && guardForm(root)) guarded += 1;
      if (guardControl(root)) guarded += 1;
    }
    if (typeof root.querySelectorAll !== 'function') return guarded;
    root.querySelectorAll('form').forEach(function (form) { if (guardForm(form)) guarded += 1; });
    root.querySelectorAll(CONTROL_SELECTOR).forEach(function (control) { if (guardControl(control)) guarded += 1; });
    return guarded;
  }

  function eventControl(event) {
    var target = event && event.target;
    if (!isElement(target)) return null;
    if (typeof target.closest !== 'function') return null;
    return target.closest('[data-autofill-readonly-lock="' + GUARD_VERSION + '"]');
  }

  function scrubUnexpectedPostUnlock(control, previousValue) {
    if (!isGuardableControl(control) || control.getAttribute('data-autofill-user-edited') === 'true') return;
    if (control.value && String(control.value) !== String(previousValue || '')) clearControlValue(control);
  }

  function schedulePostUnlockScrub(control, previousValue) {
    [0, 80, 300, 800].forEach(function (delayMs) {
      window.setTimeout(function () { scrubUnexpectedPostUnlock(control, previousValue); }, delayMs);
    });
  }

  function unlockForPointerCompletion(event) {
    if (event && event.isTrusted === false) return;
    var control = eventControl(event);
    if (!control) return;
    var previousValue = String(control.value || '');
    control.setAttribute('data-autofill-user-intent', String(Date.now()));
    unlockControl(control);
    schedulePostUnlockScrub(control, previousValue);
  }

  function unlockForKeyboard(event) {
    if (event && event.isTrusted === false) return;
    var control = eventControl(event);
    if (control) {
      control.setAttribute('data-autofill-user-intent', String(Date.now()));
      unlockControl(control);
    }
  }

  function setUserEdited(target) {
    if (!isGuardableControl(target)) return false;
    setAttributeIfChanged(target, 'data-autofill-user-edited', 'true');
    return true;
  }

  function markKeyboardEdit(event) {
    if (!event || event.isTrusted === false || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    var key = String(event.key || '');
    if (key.length === 1 || key === 'Backspace' || key === 'Delete') setUserEdited(event.target);
  }

  function markBeforeInputEdit(event) {
    if (!event || event.isTrusted === false) return;
    var inputType = String(event.inputType || '');
    if (/^(?:insertText|insertCompositionText|insertFromPaste|insertFromDrop|deleteContent)/.test(inputType)) setUserEdited(event.target);
  }

  function markDirectEdit(event) {
    if (!event || event.isTrusted === false) return;
    setUserEdited(event.target);
  }

  function clearControlValue(target) {
    if (!target || !('value' in target) || !target.value) return false;
    target.value = '';
    target.removeAttribute('data-autofill-user-edited');
    if (typeof target.dispatchEvent === 'function' && typeof Event === 'function') {
      target.dispatchEvent(new Event('input', { bubbles:true }));
      target.dispatchEvent(new Event('change', { bubbles:true }));
    }
    return true;
  }

  function clearDetectedAutofill(event) {
    if (!event || event.animationName !== AUTOFILL_ANIMATION) return false;
    var target = event.target;
    if (!isGuardableControl(target) || target.getAttribute('data-autofill-user-edited') === 'true') return false;
    return clearControlValue(target);
  }

  function blockUnexpectedFill(event) {
    var target = event && event.target;
    if (!isGuardableControl(target) || target.getAttribute('data-autofill-user-edited') === 'true') return false;
    var inputType = String(event.inputType || '');
    var likelyAutofill = !inputType || /(?:replacement|history|autofill)/i.test(inputType);
    if (!likelyAutofill || !target.value) return false;
    return clearControlValue(target);
  }

  function rearmEmptyControl(event) {
    var target = event && event.target;
    if (!isGuardableControl(target) || target.value) return;
    target.removeAttribute('data-autofill-user-edited');
    target.removeAttribute('data-autofill-user-intent');
    window.setTimeout(function () { if (!target.value && document.activeElement !== target) armReadonly(target); }, 0);
  }

  function observeDocument() {
    if (typeof document === 'undefined') return;
    guardTree(document);
    document.addEventListener('pointerup', unlockForPointerCompletion, true);
    document.addEventListener('touchend', unlockForPointerCompletion, true);
    document.addEventListener('keydown', unlockForKeyboard, true);
    document.addEventListener('keydown', markKeyboardEdit, true);
    document.addEventListener('beforeinput', markBeforeInputEdit, true);
    document.addEventListener('paste', markDirectEdit, true);
    document.addEventListener('drop', markDirectEdit, true);
    document.addEventListener('input', blockUnexpectedFill, true);
    document.addEventListener('change', blockUnexpectedFill, true);
    document.addEventListener('focusout', rearmEmptyControl, true);
    document.addEventListener('animationstart', clearDetectedAutofill, true);
    document.addEventListener('DOMContentLoaded', function () { guardTree(document); }, { once:true });
    window.addEventListener('pageshow', function () { guardTree(document); });

    if (typeof MutationObserver !== 'function' || !document.documentElement) return;
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'attributes') {
          if (record.target && record.target.tagName === 'FORM') guardForm(record.target);
          else guardControl(record.target);
          return;
        }
        record.addedNodes.forEach(function (node) { guardTree(node); });
      });
    });
    observer.observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['type', 'autocomplete', 'contenteditable', 'data-credential-autofill', 'data-autofill-scope', 'data-autofill-preserve']
    });
  }

  var api = Object.freeze({
    version:GUARD_VERSION,
    selector:CONTROL_SELECTOR,
    guardControl:guardControl,
    guardForm:guardForm,
    guardTree:guardTree,
    unlockControl:unlockControl,
    clearDetectedAutofill:clearDetectedAutofill,
    blockUnexpectedFill:blockUnexpectedFill,
    scrubUnexpectedPostUnlock:scrubUnexpectedPostUnlock,
    isCredentialAllowed:isCredentialAllowed,
    releaseGuard:releaseGuard
  });
  try { Object.defineProperty(globalThis, '__TXT_READER_NON_AUTH_AUTOFILL_GUARD__', { value:api, configurable:false }); }
  catch (_error) { globalThis.__TXT_READER_NON_AUTH_AUTOFILL_GUARD__ = api; }
  observeDocument();
}());
