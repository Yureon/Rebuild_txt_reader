const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'../..');
const ui=fs.readFileSync(path.join(root,'public/scripts/rebuild/features/ui.mjs'),'utf8');
const shell=fs.readFileSync(path.join(root,'public/fragments/app-shell.html'),'utf8');
assert.ok(ui.includes('v417-skeleton-timing-polish-pass')&&ui.includes('clearBootSkeleton')&&ui.includes('clearResolvedLazySkeletons'),'skeleton timing runtime missing');
for(const marker of ['v417-settings-lazy-skeleton-pass','v417-read-data-skeleton-pass','v417-recovery-skeleton-pass']) assert.ok(shell.includes(marker), marker+' missing');
console.log('v417-skeleton-timing-polish-smoke-pass');
