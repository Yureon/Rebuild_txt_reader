'use strict';

const path = require('path');
const packageJson = require(path.join(__dirname, '..', 'package.json'));

function packageVersionToReleaseNumber(version) {
  const match = String(version || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(`Unsupported package version: ${version}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || minor > 99) {
    throw new Error(`Package version cannot map to TXT Reader release number: ${version}`);
  }
  return (major * 100) + minor;
}

const APP_VERSION = String(packageJson.version || '').trim();
const RELEASE_NUMBER = packageVersionToReleaseNumber(APP_VERSION);
const BUILD_ID = `rebuild-v${RELEASE_NUMBER}`;
const RELEASE_LABEL = `v${RELEASE_NUMBER}`;
const VERSION_CONTRACT_PASS = 'v642-central-version-contract-pass';

module.exports = {
  APP_VERSION,
  RELEASE_NUMBER,
  BUILD_ID,
  RELEASE_LABEL,
  VERSION_CONTRACT_PASS,
  packageVersionToReleaseNumber
};
