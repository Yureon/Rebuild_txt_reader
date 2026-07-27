import { mountAppShell } from './core/app-shell.mjs';
import { boot } from './main.mjs';

export const LIBRARY_PAGE_ENTRY_PASS = 'v574-library-page-entry-pass';

async function start() {
  document.documentElement.dataset.appReady = 'false';
  document.documentElement.setAttribute('aria-busy', 'true');
  window.__TXT_READER_BOOT_MODE__ = 'rebuild-v682-library';
  window.__TXT_READER_CLIENT_PROFILE__ = 'library';
  window.__TXT_READER_REBUILD_BOOT_STARTED__ = false;
  window.__TXT_READER_REBUILD_BOOT_OK__ = false;
  window.__TXT_READER_REBUILD_BOOT_ERROR__ = '';
  try {
    await mountAppShell('library');
    await boot({ profile:'library' });
    document.documentElement.dataset.appReady = 'true';
    document.documentElement.removeAttribute('aria-busy');
    document.documentElement.dataset.libraryPageEntryPass = LIBRARY_PAGE_ENTRY_PASS;
  } catch (error) {
    window.__TXT_READER_REBUILD_BOOT_ERROR__ = error && (error.stack || error.message) || String(error);
    if (error?.code !== 'CLIENT_AUTH_REDIRECT') {
      document.documentElement.removeAttribute('aria-busy');
      console.error('[txt-reader] library boot failed', error);
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
else start();
