#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const RELEASE_ARCHIVE_BACKUP_PASS = 'v411-release-archive-backup-pass';
const FORBIDDEN = ['node_modules', 'data', 'sync_data.json', 'sync_data.json.bak', 'test_novels', '.npm-cache'];
const PACKAGE_LOCK_REGULAR_FILE_PASS = 'v532-package-lock-regular-file-pass';

function buildTarExcludeArgs() {
  const args = [];
  for (const item of FORBIDDEN) {
    args.push('--exclude=' + item, '--exclude=*/' + item);
  }
  return args;
}

function assertPackageLockRegularFile(projectRoot) {
  const target = path.join(projectRoot, 'package-lock.json');
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('package-lock.json must be a regular file, not a symlink');
  return { pass: PACKAGE_LOCK_REGULAR_FILE_PASS, file: 'package-lock.json', regular: true, symlink: false, bytes: stat.size };
}

function createTarGz(projectRoot, outPath) {
  if (!projectRoot) throw new Error('projectRoot required');
  if (!outPath) throw new Error('outPath required');
  const lockAudit = assertPackageLockRegularFile(projectRoot);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const result = childProcess.spawnSync('tar', ['-czf', outPath, ...buildTarExcludeArgs(), '-C', projectRoot, '.'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'tar failed');
  return { pass: RELEASE_ARCHIVE_BACKUP_PASS, outPath: path.resolve(outPath), forbidden: FORBIDDEN.slice(), packageLockAudit: lockAudit };
}

if (require.main === module) {
  const outArg = process.argv.find(arg => arg.startsWith('--out='));
  const out = outArg ? outArg.split('=').slice(1).join('=') : path.resolve(process.cwd(), '..', 'txt_reader_multi_backup.tar.gz');
  console.log(JSON.stringify(createTarGz(process.cwd(), out)));
}

module.exports = { RELEASE_ARCHIVE_BACKUP_PASS, PACKAGE_LOCK_REGULAR_FILE_PASS, FORBIDDEN, buildTarExcludeArgs, assertPackageLockRegularFile, createTarGz };
