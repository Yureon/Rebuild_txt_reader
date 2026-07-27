#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  ALL_GROUPS,
  uniqueTasks,
  classifyBlockedDependency,
  allowDependencyBlocks
} = require('./run_smoke_tests.js');

const root = path.resolve(__dirname, '..');
const processTreeRunner = path.join(root, 'tools', 'process-tree-runner.js');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function parseArgs(argv) {
  const groupArg = argv.find(arg => /^--(?:quick|full|standard|settings|frontend|server|audit|docs|cache|security|reader|search)$/.test(arg));
  const group = groupArg ? groupArg.slice(2) : '';
  if (!group || !ALL_GROUPS[group]) throw new Error('usage: node tools/run_smoke_tests_parallel.js --quick|--full');
  const concurrencyArg = argv.find(arg => arg.startsWith('--concurrency='));
  const timeoutArg = argv.find(arg => arg.startsWith('--timeout-ms='));
  const outputArg = argv.find(arg => arg.startsWith('--output='));
  return {
    group,
    concurrency:Math.max(1, Math.min(16, Number(concurrencyArg?.split('=')[1]) || 6)),
    timeoutMs:Math.max(1000, Math.min(15 * 60 * 1000, Number(timeoutArg?.split('=')[1]) || 20000)),
    output:outputArg ? path.resolve(root, outputArg.split('=').slice(1).join('=')) : path.join(root, `v${(Number(String(packageJson.version || '').split('.')[0]) * 100) + Number(String(packageJson.version || '').split('.')[1])}_${group}_parallel_results.json`)
  };
}

function runTask(task, timeoutMs) {
  return new Promise(resolve => {
    const args = [processTreeRunner, `--cwd=${root}`, `--timeout-ms=${timeoutMs}`, '--', task.command, ...task.args];
    const child = spawn(process.execPath, args, { cwd:root, env:process.env, stdio:['ignore','pipe','pipe'], windowsHide:true });
    let stdout=''; let stderr='';
    const append=(which, chunk)=>{
      const next=which+chunk.toString();
      return next.length > 16*1024*1024 ? next.slice(-16*1024*1024) : next;
    };
    child.stdout.on('data', chunk => { stdout=append(stdout,chunk); });
    child.stderr.on('data', chunk => { stderr=append(stderr,chunk); });
    child.on('error', error => resolve({ label:task.label,status:null,ok:false,blocked:false,timedOut:error.code==='ETIMEDOUT',error:error.message,stdout,stderr }));
    child.on('close', status => {
      const combined=stdout+'\n'+stderr;
      const dependency=classifyBlockedDependency(combined);
      const explicitStaticOnly=/"staticOnly"\s*:\s*true|"mode"\s*:\s*"static-only"/i.test(combined);
      const explicitPartial=status===77 && /"(?:partialPass|blocked|blockedCapabilities|blockedDependency|staticOnly|mode)"/.test(combined);
      const inferredDependencyBlock=status!==0 && dependency.blocked;
      const blocked=explicitStaticOnly || explicitPartial || (inferredDependencyBlock && allowDependencyBlocks());
      resolve({
        label:task.label,
        status,
        ok:status===0 && !blocked,
        blocked,
        testStrength:explicitStaticOnly?'static-only':blocked?'environment-blocked':'runtime',
        dependency:dependency.dependency,
        dependencyBlockOptIn:inferredDependencyBlock && allowDependencyBlocks(),
        timedOut:status===124,
        stdout,
        stderr
      });
    });
  });
}

async function main() {
  const options=parseArgs(process.argv.slice(2));
  const tasks=uniqueTasks(ALL_GROUPS[options.group]);
  const results=new Array(tasks.length);
  let cursor=0; let completed=0;
  async function worker() {
    while (true) {
      const index=cursor++;
      if (index>=tasks.length) return;
      const result=await runTask(tasks[index],options.timeoutMs);
      results[index]=result;
      completed++;
      process.stdout.write(`[${completed}/${tasks.length}] ${result.ok?'PASS':result.blocked?'BLOCK':result.timedOut?'TIMEOUT':'FAIL'} ${result.label}\n`);
    }
  }
  await Promise.all(Array.from({length:Math.min(options.concurrency,tasks.length)},()=>worker()));
  const payload={
    schemaVersion:1,
    pass:`v${(Number(String(packageJson.version || '').split('.')[0]) * 100) + Number(String(packageJson.version || '').split('.')[1])}-parallel-${options.group}-smoke-results`,
    group:options.group,
    executionMode:'parallel-independent-same-task-list',
    generatedAt:new Date().toISOString(),
    packageVersion:packageJson.version,
    total:tasks.length,
    passed:results.filter(x=>x?.ok).length,
    environmentBlocked:results.filter(x=>x?.blocked && x?.testStrength!=='static-only').length,
    staticOnly:results.filter(x=>x?.testStrength==='static-only').length,
    codeFailures:results.filter(x=>x && !x.ok && !x.blocked && !x.timedOut).length,
    timedOut:results.filter(x=>x?.timedOut).length,
    concurrency:options.concurrency,
    commandTimeoutMs:options.timeoutMs,
    results
  };
  fs.writeFileSync(options.output,JSON.stringify(payload,null,2)+'\n');
  console.log(JSON.stringify({...payload,results:undefined,output:path.relative(root,options.output)},null,2));
  if (payload.codeFailures || payload.timedOut) process.exit(1);
}
main().catch(error=>{console.error(error.stack||error);process.exit(2);});
