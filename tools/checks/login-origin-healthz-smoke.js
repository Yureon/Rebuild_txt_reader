#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 36000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const LOGIN_ID = 'origin-smoke-user';
const LOGIN_PW = 'origin-smoke-pass';
const TEST_LIBRARY_PATH = path.join(ROOT, 'test_novels_origin_healthz');
const PASS = 'v340-login-origin-healthz-smoke-pass';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(url, options = {}) {
  const parsed = new URL(url);
  const body = options.body == null ? null : Buffer.from(String(options.body));
  const headers = Object.assign({}, options.headers || {});
  if (body && headers['content-length'] == null && headers['Content-Length'] == null) {
    headers['content-length'] = String(body.length);
  }
  return new Promise((resolve, reject) => {
    const req = http.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        text: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('request timeout')));
    if (body) req.write(body);
    req.end();
  });
}

async function waitForHealthz(child) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 8000) {
    if (child.exitCode != null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const res = await request(`${BASE}/healthz`);
      if (res.status === 200) return res;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`server did not expose /healthz: ${lastError && lastError.message || 'timeout'}`);
}

async function main() {
  fs.mkdirSync(TEST_LIBRARY_PATH, { recursive: true });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      LIBRARY_PATH: TEST_LIBRARY_PATH,
      LOGINID: LOGIN_ID,
      LOGINPW: LOGIN_PW,
      APP_ORIGIN: 'http://192.168.0.10:3000',
      URL: 'https://reader.example.com, https://reader-alt.example.com/'
    })
  });

  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });

  try {
    let health;
    try {
      health = await waitForHealthz(child);
    } catch (error) {
      if (stderr) error.message += `\nChild server stderr:\n${stderr}`;
      throw error;
    }
    assert.strictEqual(health.status, 200, 'healthz returns 200 before login');
    assert.match(health.headers['cache-control'] || '', /no-store/, 'healthz is not cached');

    const allowedLogin = await request(`${BASE}/api/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://reader.example.com/'
      },
      body: JSON.stringify({ id: LOGIN_ID, pw: LOGIN_PW })
    });
    assert.strictEqual(allowedLogin.status, 200, 'external URL origin login should pass');
    assert.ok(String(allowedLogin.headers['set-cookie'] || '').includes('session_token='), 'login should set session cookie');

    const blockedLogin = await request(`${BASE}/api/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://blocked.example.com'
      },
      body: JSON.stringify({ id: LOGIN_ID, pw: LOGIN_PW })
    });
    assert.strictEqual(blockedLogin.status, 403, 'unlisted origin should remain blocked');

    console.log(JSON.stringify({ pass: PASS }));
  } finally {
    child.kill('SIGTERM');
    try { fs.rmSync(TEST_LIBRARY_PATH, { recursive: true, force: true }); } catch (error) {}
    if (stderr && process.env.DEBUG_SMOKE) process.stderr.write(stderr);
  }
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
