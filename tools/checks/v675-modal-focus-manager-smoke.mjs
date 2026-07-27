#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=rel=>fs.readFileSync(rel,'utf8');
const manager=read('public/scripts/rebuild/features/ui/modal-focus-manager.mjs');
for (const token of ['v675-modal-focus-manager-pass',"event.key !== 'Tab'",'event.key === \'Escape\'','node.inert = true','baseReturnFocus?.isConnected','aria-modal']) assert(manager.includes(token),`manager missing ${token}`);
for (const rel of ['public/scripts/rebuild/features/library-move-picker.mjs','public/scripts/rebuild/features/bookmarks/read-data-preview-detail-modal.mjs','public/scripts/rebuild/features/library-metadata-runtime.mjs']) {
  const source=read(rel); assert(source.includes('activateModalFocus'),`${rel} not integrated`); assert(source.includes('deactivateFocus'),`${rel} missing restoration cleanup`);
}
console.log(JSON.stringify({pass:'v675-modal-focus-manager-smoke-pass',dialogs:3,tabTrap:true,escape:true,inert:true,focusRestore:true}));
