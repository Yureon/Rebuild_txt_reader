#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { createMetadataCandidateShardStore } = require('../services/metadata-candidate-shard-store');

function fail(error) {
  process.stderr.write(String(error && (error.stack || error.message) || error) + '\n');
  process.exit(1);
}

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const store = createMetadataCandidateShardStore({
    baseDir:String(input.baseDir || ''),
    shardCount:Number(input.shardCount) || 32,
    compressionLevel:Number(input.compressionLevel) || 6,
    logger:{ warn() {}, error() {}, info() {}, log() {} }
  });
  const result = store.loadBounded(input.manifest, {}, {
    maxCandidates:Number(input.maxCandidates) || 20000,
    maxCandidatesPerWork:Number(input.maxCandidatesPerWork) || 30,
    maxCandidateResidentBytes:Number(input.maxCandidateResidentBytes) || 50331648,
    protectedIds:new Set(Array.isArray(input.protectedIds) ? input.protectedIds.map(String) : [])
  });
  process.stdout.write(JSON.stringify({
    candidates:result.candidates,
    seen:result.seen,
    retained:result.retained,
    removed:result.removed,
    logicalBytes:result.logicalBytes,
    warnings:result.warnings || []
  }));
} catch (error) { fail(error); }
