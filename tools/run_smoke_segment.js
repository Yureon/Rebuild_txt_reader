#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { ALL_GROUPS, uniqueTasks, runCommand } = require('./run_smoke_tests');
const root = path.resolve(__dirname,'..');
const args = Object.fromEntries(process.argv.slice(2).map(v => { const [k,...rest]=v.replace(/^--/,'').split('='); return [k,rest.join('=')]; }));
const group=String(args.group||'quick');
if(!ALL_GROUPS[group]) throw new Error(`unknown group ${group}`);
const tasks=uniqueTasks(ALL_GROUPS[group]);
const start=Math.max(1,Number(args.start)||1);
const end=Math.min(tasks.length,Number(args.end)||tasks.length);
if(start>end) throw new Error('invalid segment');
const results=[];
for(let index=start;index<=end;index++) results.push(runCommand(tasks[index-1],index,tasks.length));
const payload={schemaVersion:1,pass:'v642-smoke-segment-pass',group,total:tasks.length,start,end,executed:results.length,passed:results.filter(x=>x.ok).length,blocked:results.filter(x=>x.blocked).length,failed:results.filter(x=>!x.ok&&!x.blocked).length,timedOut:results.filter(x=>x.timedOut).length,results};
const out=args.out?path.resolve(root,args.out):path.join(root,'data','diagnostics',`smoke-${group}-${start}-${end}.json`);
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify({...payload,results:undefined,out},null,2));
if(payload.failed) process.exitCode=1;
