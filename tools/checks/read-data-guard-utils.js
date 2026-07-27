const FRONTEND_CHECK_READ_DATA_GUARD_UTILS_PASS = 'v195-read-data-guard-utils-pass';

function requireMarker(source, marker, label) {
  if (!source || !source.includes(marker)) throw new Error('Missing ' + label + ' marker: ' + marker);
}

function requireNoFunctionOwner(source, functionName, label) {
  const pattern = new RegExp('function\\s+' + functionName + '\\s*\\(');
  if (pattern.test(source)) throw new Error('Unexpected function ownership in ' + label + ': ' + functionName);
}

module.exports = {
  FRONTEND_CHECK_READ_DATA_GUARD_UTILS_PASS,
  requireMarker,
  requireNoFunctionOwner
};
