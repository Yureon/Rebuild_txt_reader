#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.resolve(__dirname,'..');
const out=process.env.DEPENDENCY_AUDIT_JSON||path.join(root,'data','diagnostics','dependency-audit-last.json');
const r=cp.spawnSync('npm',['audit','--json','--omit=dev'],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:20*1024*1024});
let report=null;
try{report=JSON.parse(r.stdout||'{}')}catch{}
const registryError=report?.error||null;
const auditReport=Boolean(report && (report.auditReportVersion || report.metadata));
const payload={
  schemaVersion:1,
  pass:'v641-dependency-audit-gate-pass',
  generatedAt:new Date().toISOString(),
  completed:auditReport,
  verified:auditReport && r.status===0,
  exitStatus:r.status,
  timedOut:r.error?.code==='ETIMEDOUT',
  error:r.error?.message||'',
  stderr:String(r.stderr||'').trim().slice(0,2000),
  registryError,
  metadata:auditReport ? report.metadata||null : null,
  vulnerabilities:auditReport ? report.vulnerabilities||null : null
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify(payload,null,2));
if(!payload.verified)process.exitCode=2;
