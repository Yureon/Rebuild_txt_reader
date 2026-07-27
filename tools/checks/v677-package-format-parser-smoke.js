#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const ignored = new Set(['node_modules','.git','data','test_novels','normalized_content','dist','.cache']);
function walk(dir, out=[]) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(full,out); else if(entry.isFile()) out.push(full);
  }
  return out;
}
const files=walk(root).sort();
const rel=f=>path.relative(root,f).replace(/\\/g,'/');
const jsonFiles=files.filter(f=>path.extname(f).toLowerCase()==='.json');
for(const file of jsonFiles) JSON.parse(fs.readFileSync(file,'utf8'));

const htmlFiles=files.filter(f=>path.extname(f).toLowerCase()==='.html');
for(const file of htmlFiles) {
  const text=fs.readFileSync(file,'utf8');
  const ids=[]; const regex=/\bid\s*=\s*["']([^"']+)["']/giu; let match;
  while((match=regex.exec(text))) ids.push(match[1]);
  const duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
  assert.equal(duplicates.length,0,`${rel(file)} duplicate ids: ${duplicates.join(', ')}`);
}

const yamlFiles=files.filter(f=>/\.ya?ml$/iu.test(f));
if(yamlFiles.length) {
  const script=`import sys, yaml\nfor name in sys.argv[1:]:\n  with open(name, encoding='utf-8') as f:\n    list(yaml.safe_load_all(f))\n`;
  const run=spawnSync(process.env.PYTHON || process.env.PYTHON3 || 'python',['-c',script,...yamlFiles],{cwd:root,encoding:'utf8',timeout:60_000,maxBuffer:4*1024*1024});
  if(run.error && run.error.code==='ENOENT') process.exit(77);
  if(run.status!==0 && /No module named ['"]yaml['"]/u.test(String(run.stderr||''))) process.exit(77);
  assert.equal(run.status,0,run.stderr||run.error?.message);
}

const xmlFiles=files.filter(f=>path.extname(f).toLowerCase()==='.xml');
if(xmlFiles.length) {
  const script=`import sys, xml.etree.ElementTree as ET\nfor name in sys.argv[1:]: ET.parse(name)\n`;
  const run=spawnSync(process.env.PYTHON || process.env.PYTHON3 || 'python',['-c',script,...xmlFiles],{cwd:root,encoding:'utf8',timeout:60_000,maxBuffer:4*1024*1024});
  if(run.error && run.error.code==='ENOENT') process.exit(77);
  assert.equal(run.status,0,run.stderr||run.error?.message);
}

const shellFiles=files.filter(f=>path.extname(f).toLowerCase()==='.sh');
if(shellFiles.length) {
  const shell=process.platform==='win32' ? '' : 'sh';
  if(!shell) process.exit(77);
  for(const file of shellFiles) {
    const run=spawnSync(shell,['-n',file],{cwd:root,encoding:'utf8',timeout:30_000});
    if(run.error && run.error.code==='ENOENT') process.exit(77);
    assert.equal(run.status,0,`${rel(file)}: ${run.stderr||run.error?.message}`);
  }
}

const envFiles=files.filter(f=>path.basename(f).startsWith('.env'));
for(const file of envFiles) {
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/u);
  lines.forEach((line,index)=>{
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#')) return;
    assert(/^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=/u.test(trimmed),`${rel(file)}:${index+1} invalid env assignment`);
  });
}

const dockerfiles=files.filter(f=>/^Dockerfile(?:\..+)?$/u.test(path.basename(f)));
for(const file of dockerfiles) {
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/u);
  let continuation=false;
  for(const raw of lines) {
    const line=raw.trim();
    if(!line||line.startsWith('#')) continue;
    if(!continuation) assert(/^[A-Z][A-Z0-9_-]+(?:\s+|$)/u.test(line),`${rel(file)} invalid instruction: ${line}`);
    continuation=/\\\s*$/u.test(line);
  }
  assert.equal(continuation,false,`${rel(file)} has dangling continuation`);
}

console.log(JSON.stringify({pass:'v677-package-format-parser-smoke-pass',files:files.length,json:jsonFiles.length,html:htmlFiles.length,yaml:yamlFiles.length,xml:xmlFiles.length,shell:shellFiles.length,env:envFiles.length,dockerfiles:dockerfiles.length}));
