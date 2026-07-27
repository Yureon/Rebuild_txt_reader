#!/usr/bin/env node
const assert=require('assert');const fs=require('fs');const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../../server/app.js'),'utf8');assert(source.includes("app.disable('x-powered-by')"),'Express fingerprint header must be disabled');console.log(JSON.stringify({pass:'v603-security-express-fingerprint-smoke-pass'}));
