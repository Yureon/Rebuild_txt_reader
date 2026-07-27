#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');for(const file of ['docker-compose.yml','docker-compose.example.yml','docker-compose.cloudflare-tunnel.example.yml']){const text=fs.readFileSync(file,'utf8');assert(text.includes('/library:${LIBRARY_MOUNT_MODE:-ro}'),`${file} must expose safe mount mode`);}const env=fs.readFileSync('.env.example','utf8');assert(env.includes('LIBRARY_MOUNT_MODE=ro'));assert(env.includes('이름 변경·이동·삭제'));console.log(JSON.stringify({pass:'v605-docker-library-mount-mode-smoke-pass'}));
