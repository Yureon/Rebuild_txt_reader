const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_CHUNK_HEADING_POLICY_SMOKE_PASS = 'v240-reader-chunk-heading-policy-smoke-pass';
const READER_CHUNK_HEADING_PROJECT_SOURCE_PASS = 'v253-reader-chunk-heading-project-source-pass';

function runReaderChunkHeadingPolicySmoke(projectRoot) {
  if (!projectRoot) throw new Error('runReaderChunkHeadingPolicySmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    headingSource: 'rebuild/features/reader/chunk-headings.mjs',
    layoutSource: 'rebuild/features/reader/virtual-layout.mjs',
    cssSource: 'public/styles/app.css'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);

  for (const marker of [
    'READER_CHUNK_HEADING_POLICY_PASS',
    'v240-reader-chunk-heading-policy-pass',
    'export function getVirtualChunkHeading',
    'if (chunk !== 1) return \'\''
  ]) {
    if (!sources.headingSource.includes(marker)) throw new Error('missing chunk heading policy marker: ' + marker);
  }

  const forbiddenContinuationHeading = '이어지는 ' + '내용';
  if (sources.layoutSource.includes(forbiddenContinuationHeading)) {
    throw new Error('virtual reader must not render the continuation chunk heading text');
  }
  for (const marker of [
    "import { getVirtualChunkHeading, hasVirtualChunkHeading } from './chunk-headings.mjs'",
    'title: getVirtualChunkHeading(entry)',
    'reader-vrow-header-empty',
    'hasVirtualChunkHeading(row) ? 76 : 0'
  ]) {
    if (!sources.layoutSource.includes(marker)) throw new Error('missing chunk heading layout marker: ' + marker);
  }
  if (!sources.cssSource.includes('.reader-vrow-header-empty')) throw new Error('missing empty chunk header CSS');
  return { pass: READER_CHUNK_HEADING_POLICY_SMOKE_PASS, projectSourcePass: READER_CHUNK_HEADING_PROJECT_SOURCE_PASS, sourceSummary };
}

module.exports = {
  READER_CHUNK_HEADING_POLICY_SMOKE_PASS,
  READER_CHUNK_HEADING_PROJECT_SOURCE_PASS,
  runReaderChunkHeadingPolicySmoke
};
