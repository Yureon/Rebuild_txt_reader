import { mountAppShell } from './core/app-shell.mjs';
import { boot } from './main.mjs';

async function start() {
  window.__TXT_READER_BOOT_MODE__ = 'rebuild-v13-mobile';
  window.__TXT_READER_CLIENT_PROFILE__ = 'mobile';
  window.__TXT_READER_REBUILD_BOOT_STARTED__ = false;
  window.__TXT_READER_REBUILD_BOOT_OK__ = false;
  window.__TXT_READER_REBUILD_BOOT_ERROR__ = '';
  try {
    await mountAppShell('mobile');
    await boot({ profile: 'mobile' });
  } catch (error) {
    window.__TXT_READER_REBUILD_BOOT_ERROR__ = error && (error.stack || error.message) || String(error);
    console.error('[txt-reader] mobile boot failed', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
