#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const files=['docker-compose.yml','docker-compose.example.yml','docker-compose.cloudflare-tunnel.example.yml'];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const lines=text.split(/\r?\n/);
  const envIndex=lines.findIndex(line=>/^\s+environment:\s*$/.test(line));
  assert(envIndex>=0,`${file}: environment block missing`);
  const indent=(lines[envIndex].match(/^\s*/)||[''])[0].length;
  const block=[];
  for(let i=envIndex+1;i<lines.length;i++){
    const line=lines[i]; if(!line.trim()) continue;
    const current=(line.match(/^\s*/)||[''])[0].length;
    if(current<=indent) break;
    block.push(line);
  }
  assert(block.some(line=>/^\s+-\s+TRUSTED_PROXY_CIDRS=/.test(line)),`${file}: trusted proxy entry must use list syntax`);
  assert(!block.some(line=>/^\s+TRUSTED_PROXY_CIDRS\s*:/.test(line)),`${file}: mixed mapping syntax remains`);
  assert(block.filter(line=>/^\s+-\s+[A-Z0-9_]+=/.test(line)).length>=3,`${file}: environment list unexpectedly small`);
}
console.log(JSON.stringify({pass:'v676-compose-environment-yaml-smoke-pass',files:files.length,mixedSyntax:false}));
