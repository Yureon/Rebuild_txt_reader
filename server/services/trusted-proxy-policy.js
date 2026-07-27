const net = require('net');

const V676_TRUSTED_PROXY_SOURCE_PASS = 'v676-trusted-proxy-validation-pass';
const DEFAULT_TRUSTED_PROXY_CIDRS = Object.freeze([
  '127.0.0.0/8', '::1/128'
]);

function normalizeIp(value) {
  let ip = String(value || '').trim().replace(/^\[|\]$/g, '').split('%')[0];
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) ip = mapped[1];
  return ip;
}

function ipv4ToBigInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) throw new Error('invalid IPv4');
  return parts.reduce((acc, part) => {
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error('invalid IPv4');
    return (acc << 8n) | BigInt(value);
  }, 0n);
}

function ipv6ToBigInt(input) {
  let ip = String(input).toLowerCase();
  if (ip.includes('.')) {
    const index = ip.lastIndexOf(':');
    const v4 = ipv4ToBigInt(ip.slice(index + 1));
    ip = `${ip.slice(0, index)}:${Number((v4 >> 16n) & 0xffffn).toString(16)}:${Number(v4 & 0xffffn).toString(16)}`;
  }
  const halves = ip.split('::');
  if (halves.length > 2) throw new Error('invalid IPv6');
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) throw new Error('invalid IPv6');
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8) throw new Error('invalid IPv6');
  return parts.reduce((acc, part) => {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) throw new Error('invalid IPv6');
    return (acc << 16n) | BigInt(parseInt(part, 16));
  }, 0n);
}

function parseCidr(entry) {
  const [rawIp, rawPrefix] = String(entry || '').trim().split('/');
  const ip = normalizeIp(rawIp);
  const family = net.isIP(ip);
  if (!family) throw new Error('invalid CIDR address');
  const bits = family === 4 ? 32 : 128;
  const prefix = rawPrefix == null || rawPrefix === '' ? bits : Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) throw new Error('invalid CIDR prefix');
  const value = family === 4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);
  const shift = BigInt(bits - prefix);
  const network = shift ? (value >> shift) << shift : value;
  return { family, bits, prefix, shift, network, source:String(entry) };
}

function parseTrustedProxyCidrs(value, fallback = DEFAULT_TRUSTED_PROXY_CIDRS) {
  const entries = String(value == null ? '' : value).split(/[\s,;]+/).map(item => item.trim()).filter(Boolean);
  const selected = entries.length ? entries : Array.from(fallback || []);
  const valid = [];
  for (const entry of selected) {
    try { parseCidr(entry); valid.push(entry); } catch {}
  }
  return valid.length ? valid : ['127.0.0.0/8', '::1/128'];
}

function createTrustedProxyPredicate(value) {
  const cidrs = parseTrustedProxyCidrs(value);
  const rules = cidrs.map(parseCidr);
  const predicate = input => {
    const ip = normalizeIp(input);
    const family = net.isIP(ip);
    if (!family) return false;
    let address;
    try { address = family === 4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip); } catch { return false; }
    return rules.some(rule => rule.family === family && (rule.shift ? (address >> rule.shift) << rule.shift : address) === rule.network);
  };
  predicate.cidrs = cidrs;
  predicate.pass = V676_TRUSTED_PROXY_SOURCE_PASS;
  return predicate;
}

function isTrustedProxySource(ip, value) { return createTrustedProxyPredicate(value)(ip); }

module.exports = {
  V675_TRUSTED_PROXY_SOURCE_PASS:V676_TRUSTED_PROXY_SOURCE_PASS,
  V676_TRUSTED_PROXY_SOURCE_PASS,
  DEFAULT_TRUSTED_PROXY_CIDRS,
  normalizeIp,
  parseTrustedProxyCidrs,
  createTrustedProxyPredicate,
  isTrustedProxySource
};
