const fs = require('fs');
const os = require('os');
const path = require('path');

const LIBRARY_REORGANIZE_FILES_SMOKE_PASS = 'v311-library-reorganize-files-smoke-pass';

function runLibraryReorganizeFilesSmoke(projectRoot) {
  const {
    LIBRARY_REORGANIZE_FILES_PASS,
    TXT_READER_EPISODES_MARKER,
    cleanTitle,
    extractAuthor,
    readPathList,
    buildRelocationPlan
  } = require('../reorganize_library_files.js');

  if (cleanTitle('(complete) Sample Novel 1-20 complete.txt') !== 'Sample Novel') {
    throw new Error('title cleaner did not remove episode/status suffix');
  }
  if (extractAuthor('Sample 1-10 complete @author.txt') !== 'author') {
    throw new Error('author extractor did not read @ suffix');
  }

  const paths = [
    '\\\\nas\\External\\novels\\==latest\\25.09.10\\(complete) Star Lord 1-2\\Star Lord 1.txt',
    '\\\\nas\\External\\novels\\==latest\\25.09.10\\(complete) Star Lord 1-2\\Star Lord 2.txt',
    '\\\\nas\\External\\novels\\==latest\\25.09.10\\(complete) Star Lord 1-2\\cover.jpg',
    '\\\\nas\\External\\novels\\==latest\\25.09.10\\Solo Novel 1-200 complete.txt',
    '\\\\nas\\External\\novels\\==latest\\25.09.10\\Author Tagged 1-40 complete @writer.txt'
  ];

  const plan = buildRelocationPlan(paths, {
    dest: 'C:\\LibraryOut',
    layout: 'date-author-title',
    includeAssets: true,
    mode: 'copy'
  });
  if (plan.pass !== LIBRARY_REORGANIZE_FILES_PASS) throw new Error('reorganize plan pass marker mismatch');
  if (plan.groups !== 3) throw new Error('expected one multi-file novel and two single-file novels');
  if (plan.txtFiles !== 4) throw new Error('expected four txt file actions');
  if (plan.markerFiles !== 3) throw new Error('expected marker for each novel folder');
  const targets = plan.actions.map(action => String(action.target || '').replace(/\\/g, '/'));
  if (!targets.some(target => target.includes('/2025-09-10/') && target.endsWith('/' + TXT_READER_EPISODES_MARKER))) {
    throw new Error('plan missing txt-reader episode marker under date layout');
  }
  if (!targets.some(target => target.includes('/writer/Author Tagged/'))) {
    throw new Error('plan missing author layout target');
  }
  if (!targets.some(target => target.endsWith('/cover.jpg'))) {
    throw new Error('plan missing cover asset target');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-reorg-smoke-'));
  const inputPath = path.join(tempDir, 'paths.txt');
  fs.writeFileSync(inputPath, Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(paths.join('\r\n'), 'utf16le')]));
  try {
    const readBack = readPathList(inputPath);
    if (readBack.length !== paths.length || !readBack[0].includes('Star Lord')) {
      throw new Error('UTF-16 path list reader failed');
    }
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_error) {}
  }

  return {
    pass: LIBRARY_REORGANIZE_FILES_SMOKE_PASS,
    reorganizePass: LIBRARY_REORGANIZE_FILES_PASS,
    groups: plan.groups,
    txtFiles: plan.txtFiles,
    markerFiles: plan.markerFiles
  };
}

module.exports = {
  LIBRARY_REORGANIZE_FILES_SMOKE_PASS,
  runLibraryReorganizeFilesSmoke
};

if (require.main === module) {
  try {
    console.log(JSON.stringify(runLibraryReorganizeFilesSmoke(path.join(__dirname, '..', '..'))));
  } catch (error) {
    console.error(error && error.stack || error);
    process.exit(1);
  }
}
