'use strict';

const fs = require('fs');
const path = require('path');

const NODE_LAUNCHER_PASS = 'v665-node-direct-launcher-pass';
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_ENV_FILE = path.join(ROOT_DIR, '.env');

function parseQuotedEnvValue(rawValue) {
  const quote = rawValue[0];
  let escaped = false;
  for (let index = 1; index < rawValue.length; index += 1) {
    const character = rawValue[index];
    if (quote === '"' && character === '\\' && !escaped) { escaped = true; continue; }
    if (character === quote && !escaped) {
      const remainder = rawValue.slice(index + 1).trim();
      if (remainder && !remainder.startsWith('#')) return null;
      let value = rawValue.slice(1, index);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return value;
    }
    escaped = false;
  }
  return null;
}

function parseEnvText(text) {
  const out = {};
  for (const rawLine of String(text || '').split(/\r?\n/u)) {
    let line = rawLine.replace(/^\uFEFF/u, '').trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) continue;
    const key = match[1];
    const rawValue = match[2].trim();
    let value = rawValue;
    if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
      const parsedQuoted = parseQuotedEnvValue(rawValue);
      if (parsedQuoted == null) continue;
      value = parsedQuoted;
    } else {
      value = rawValue.replace(/\s+#.*$/u, '').trim();
    }
    out[key] = value;
  }
  return out;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { envFile:'', noEnv:false, help:false, version:false, checkConfig:false, overrides:{} };
  const take = (index, name) => {
    const value = argv[index + 1];
    if (value == null || String(value).startsWith('--')) throw Object.assign(new Error(`${name} requires a value`), { code:'NODE_LAUNCH_ARGUMENT_INVALID' });
    return String(value);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--check-config') options.checkConfig = true;
    else if (arg === '--no-env') options.noEnv = true;
    else if (arg === '--env-file') { options.envFile = take(i, '--env-file'); i += 1; }
    else if (arg.startsWith('--env-file=')) options.envFile = arg.slice(11);
    else if (arg === '--host') { options.overrides.HOST = take(i, '--host'); i += 1; }
    else if (arg.startsWith('--host=')) options.overrides.HOST = arg.slice(7);
    else if (arg === '--port') { options.overrides.PORT = take(i, '--port'); i += 1; }
    else if (arg.startsWith('--port=')) options.overrides.PORT = arg.slice(7);
    else if (arg === '--library') { options.overrides.LIBRARY_PATH = take(i, '--library'); i += 1; }
    else if (arg.startsWith('--library=')) options.overrides.LIBRARY_PATH = arg.slice(10);
    else if (arg === '--data-dir') { options.overrides.TXT_READER_DATA_DIR = take(i, '--data-dir'); i += 1; }
    else if (arg.startsWith('--data-dir=')) options.overrides.TXT_READER_DATA_DIR = arg.slice(11);
    else throw Object.assign(new Error(`unknown option: ${arg}`), { code:'NODE_LAUNCH_ARGUMENT_INVALID' });
  }
  return options;
}

function normalizePort(value) {
  const port = Number(String(value == null ? '' : value).trim() || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error('PORT must be an integer from 1 to 65535'), { code:'NODE_LAUNCH_PORT_INVALID' });
  return String(port);
}

function normalizeHost(value) {
  const host = String(value == null ? '' : value).trim();
  if (/[\u0000-\u0020]/u.test(host)) throw Object.assign(new Error('HOST contains whitespace or control characters'), { code:'NODE_LAUNCH_HOST_INVALID' });
  return host;
}

function absoluteConfiguredPath(value, baseDir) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  return path.resolve(baseDir, raw);
}

function configureNodeEnvironment(options = parseArgs()) {
  const envFile = options.noEnv ? '' : path.resolve(process.cwd(), options.envFile || DEFAULT_ENV_FILE);
  const loaded = new Set();
  if (envFile && fs.existsSync(envFile)) {
    const parsed = parseEnvText(fs.readFileSync(envFile, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
      process.env[key] = value;
      loaded.add(key);
    }
  } else if (options.envFile && !options.noEnv) {
    throw Object.assign(new Error(`environment file not found: ${envFile}`), { code:'NODE_LAUNCH_ENV_FILE_NOT_FOUND' });
  }

  for (const [key, value] of Object.entries(options.overrides || {})) process.env[key] = String(value);
  process.env.PORT = normalizePort(process.env.PORT);
  process.env.HOST = normalizeHost(process.env.HOST);

  const envBase = envFile ? path.dirname(envFile) : ROOT_DIR;
  const cliKeys = new Set(Object.keys(options.overrides || {}));
  for (const key of ['LIBRARY_PATH','TXT_READER_DATA_DIR']) {
    const value = process.env[key];
    if (!value) continue;
    const base = cliKeys.has(key) ? process.cwd() : (loaded.has(key) ? envBase : process.cwd());
    process.env[key] = absoluteConfiguredPath(value, base);
  }
  process.env.TXT_READER_LAUNCH_MODE = 'node';
  return {
    pass:NODE_LAUNCHER_PASS,
    envFile:envFile && fs.existsSync(envFile) ? envFile : '',
    port:process.env.PORT,
    host:process.env.HOST,
    libraryPath:process.env.LIBRARY_PATH || '/library',
    dataDir:process.env.TXT_READER_DATA_DIR || path.join(ROOT_DIR, 'data'),
    deploymentMode:process.env.DEPLOYMENT_MODE || 'direct'
  };
}

function usage() {
  return [
    'TXT Reader Multi Node launcher',
    '',
    'Usage:',
    '  node server.js [options]',
    '  node . [options]',
    '',
    'Options:',
    '  --env-file <path>   Load an environment file (default: project .env)',
    '  --no-env            Do not load a .env file',
    '  --host <host>       Override HOST',
    '  --port <port>       Override PORT',
    '  --library <path>    Override LIBRARY_PATH',
    '  --data-dir <path>   Override TXT_READER_DATA_DIR',
    '  --check-config      Validate and print non-secret resolved settings',
    '  --version           Print package version',
    '  --help              Show this help'
  ].join('\n');
}

function launchNodeServer(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { process.stdout.write(`${usage()}\n`); return null; }
  if (options.version) {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    process.stdout.write(`${pkg.version}\n`);
    return null;
  }
  const config = configureNodeEnvironment(options);
  if (options.checkConfig) { process.stdout.write(`${JSON.stringify(config, null, 2)}\n`); return null; }
  return require('./bootstrap');
}

module.exports = {
  NODE_LAUNCHER_PASS,
  ROOT_DIR,
  DEFAULT_ENV_FILE,
  parseQuotedEnvValue,
  parseEnvText,
  parseArgs,
  configureNodeEnvironment,
  usage,
  launchNodeServer
};
