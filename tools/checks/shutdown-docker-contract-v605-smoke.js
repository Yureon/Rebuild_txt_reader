#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');const bootstrap=fs.readFileSync('server/bootstrap.js','utf8');
assert(bootstrap.includes("GRACEFUL_SHUTDOWN_DRAIN_PASS = 'v605-graceful-shutdown-drain-pass'"));assert(bootstrap.includes('SHUTDOWN_GRACE_MS'));assert(bootstrap.includes('SHUTDOWN_HTTP_DRAIN_MS'));assert(bootstrap.includes('server.closeAllConnections?.()'));assert(bootstrap.indexOf('await closePromise')<bootstrap.indexOf('await stop()'));
for(const file of ['docker-compose.yml','docker-compose.example.yml','docker-compose.cloudflare-tunnel.example.yml']){const text=fs.readFileSync(file,'utf8');assert(text.includes('stop_grace_period: 60s'),`${file} stop grace missing`);assert(text.includes('SHUTDOWN_GRACE_MS=${SHUTDOWN_GRACE_MS:-45000}'));assert(text.includes('SHUTDOWN_HTTP_DRAIN_MS=${SHUTDOWN_HTTP_DRAIN_MS:-10000}'));}
const dockerfile=fs.readFileSync('Dockerfile','utf8');assert(dockerfile.includes('SHUTDOWN_GRACE_MS=45000'));assert(dockerfile.includes('SHUTDOWN_HTTP_DRAIN_MS=10000'));console.log(JSON.stringify({pass:'v605-shutdown-docker-contract-smoke-pass'}));
