#!/usr/bin/env node
'use strict';
const https = require('https');
const { getMetadataSiteAdapter } = require('../../server/services/metadata-site-adapters');

const enabled = /^(1|true|yes|on)$/i.test(String(process.env.RUN_LIVE_PROVIDER_CHECKS || ''));
if (!enabled) {
  console.log(JSON.stringify({ partialPass:'v641-ssn-live-contract-blocked', blockedCapabilities:['provider-network'], message:'Set RUN_LIVE_PROVIDER_CHECKS=1 to execute the live SSN endpoint contract.' }));
  process.exit(77);
}

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout:15000,
      headers:{
        'User-Agent':'Mozilla/5.0 (compatible; TXT Reader Multi provider contract check)',
        'Accept':'text/html,application/xhtml+xml'
      }
    }, response => {
      const location = response.headers.location;
      if (location && response.statusCode >= 300 && response.statusCode < 400 && redirects < 3) {
        response.resume();
        return resolve(get(new URL(location, url).href, redirects + 1));
      }
      const chunks=[]; let bytes=0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes <= 2*1024*1024) chunks.push(chunk); });
      response.on('end', () => resolve({ status:response.statusCode, headers:response.headers, body:Buffer.concat(chunks).toString('utf8'), finalUrl:url }));
    });
    request.on('timeout', () => request.destroy(new Error('SSN live contract timeout')));
    request.on('error', reject);
  });
}

(async () => {
  const query = String(process.env.SSN_LIVE_QUERY || '전능한 검색창을 얻었다').trim();
  const adapter = getMetadataSiteAdapter('ssn-series-v1');
  if (!adapter) throw new Error('ssn adapter missing');
  const searchUrl = `https://ssn.so/series/?keyword=${encodeURIComponent(query)}`;
  const result = await get(searchUrl);
  if (result.status !== 200) throw new Error(`SSN search HTTP ${result.status}`);
  if (!/text\/html|application\/xhtml\+xml/i.test(String(result.headers['content-type'] || ''))) throw new Error(`SSN search content type mismatch: ${result.headers['content-type'] || ''}`);
  const candidates = adapter.parseSearchResults(result.body, result.finalUrl, { title:query, author:'' }, 10);
  if (!candidates.length) throw new Error('SSN live search returned no parseable series detail links');
  const detail = await get(candidates[0].sourceUrl);
  if (detail.status !== 200) throw new Error(`SSN detail HTTP ${detail.status}`);
  const parsed = adapter.parseDetail(detail.body, detail.finalUrl, 8000);
  if (!parsed || !parsed.title || !parsed.sourceUrl) throw new Error('SSN live detail metadata contract failed');
  console.log(JSON.stringify({ pass:'v641-ssn-live-contract-pass', query, searchUrl, candidateCount:candidates.length, detailUrl:parsed.sourceUrl, title:parsed.title }));
})().catch(error => { console.error(error); process.exit(1); });
