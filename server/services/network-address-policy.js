const dns = require('dns');
const net = require('net');

const NETWORK_ADDRESS_POLICY_PASS = 'v622-network-address-policy-pass';

function ipv4ToInt(address) {
  const parts = String(address || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return parts.reduce((value, part) => ((value << 8) | part) >>> 0, 0) >>> 0;
}

function ipv4InCidr(address, base, bits) {
  const value = ipv4ToInt(address);
  const network = ipv4ToInt(base);
  if (value == null || network == null) return false;
  const prefix = Math.max(0, Math.min(32, Number(bits) || 0));
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (network & mask);
}

const BLOCKED_IPV4 = Object.freeze([
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
]);

function isPrivateIpv4(address) {
  if (ipv4ToInt(address) == null) return true;
  return BLOCKED_IPV4.some(([base, bits]) => ipv4InCidr(address, base, bits));
}

function expandIpv6(address) {
  let input = String(address || '').trim().toLowerCase().split('%')[0];
  if (!input || input.includes(':::')) return null;
  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':');
    const ipv4 = input.slice(lastColon + 1);
    const value = ipv4ToInt(ipv4);
    if (value == null) return null;
    input = `${input.slice(0, lastColon)}:${((value >>> 16) & 0xffff).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const halves = input.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const words = [...left, ...Array(missing).fill('0'), ...right];
  if (words.length !== 8 || words.some(word => !/^[0-9a-f]{1,4}$/u.test(word))) return null;
  return words.map(word => Number.parseInt(word, 16));
}

function ipv6ToBigInt(address) {
  const words = expandIpv6(address);
  if (!words) return null;
  return words.reduce((value, word) => (value << 16n) | BigInt(word), 0n);
}

function ipv6InCidr(address, base, bits) {
  const value = ipv6ToBigInt(address);
  const network = ipv6ToBigInt(base);
  if (value == null || network == null) return false;
  const prefix = Math.max(0, Math.min(128, Number(bits) || 0));
  if (prefix === 0) return true;
  const shift = BigInt(128 - prefix);
  return (value >> shift) === (network >> shift);
}

function embeddedIpv4(address) {
  const words = expandIpv6(address);
  if (!words) return null;
  const upper96Zero = words.slice(0, 6).every(word => word === 0);
  const mapped = words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff;
  if (!upper96Zero && !mapped) return null;
  const value = ((words[6] << 16) | words[7]) >>> 0;
  return `${(value >>> 24) & 255}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${value & 255}`;
}

const BLOCKED_IPV6 = Object.freeze([
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 32], ['2001:2::', 48], ['2001:10::', 28], ['2001:20::', 28], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]
]);

function isPrivateIpv6(address) {
  const normalized = String(address || '').trim().toLowerCase().split('%')[0];
  if (ipv6ToBigInt(normalized) == null) return true;
  const embedded = embeddedIpv4(normalized);
  if (embedded) return isPrivateIpv4(embedded);
  return BLOCKED_IPV6.some(([base, bits]) => ipv6InCidr(normalized, base, bits));
}

function isPublicAddress(address) {
  const family = net.isIP(String(address || '').split('%')[0]);
  if (family === 4) return !isPrivateIpv4(address);
  if (family === 6) return !isPrivateIpv6(address);
  return false;
}

async function resolvePublicAddresses(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  const directFamily = net.isIP(host);
  if (directFamily) {
    if (!isPublicAddress(host)) throw Object.assign(new Error('host is a private or reserved address'), { code:'METADATA_SSRF_BLOCKED' });
    return [{ address:host, family:directFamily }];
  }
  const answers = await dns.promises.lookup(host, { all:true, verbatim:true });
  if (!answers.length) throw Object.assign(new Error('host DNS lookup returned no addresses'), { code:'METADATA_DNS_EMPTY' });
  for (const item of answers) {
    if (!isPublicAddress(item.address)) throw Object.assign(new Error('host resolved to a private or reserved address'), { code:'METADATA_SSRF_BLOCKED' });
  }
  return answers;
}

async function resolvePinnedAddress(hostname) {
  const answers = await resolvePublicAddresses(hostname);
  return answers[0];
}

module.exports = {
  NETWORK_ADDRESS_POLICY_PASS,
  ipv4ToInt,
  ipv4InCidr,
  isPrivateIpv4,
  expandIpv6,
  ipv6ToBigInt,
  ipv6InCidr,
  embeddedIpv4,
  isPrivateIpv6,
  isPublicAddress,
  resolvePublicAddresses,
  resolvePinnedAddress
};
