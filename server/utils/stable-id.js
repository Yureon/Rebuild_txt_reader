const STABLE_ID_CACHE = new Map();

function encodeStableId(value) {
  const key = String(value || '');
  let hit = STABLE_ID_CACHE.get(key);
  if (!hit) {
    hit = Buffer.from(key).toString('base64url');
    if (STABLE_ID_CACHE.size > 50000) STABLE_ID_CACHE.clear();
    STABLE_ID_CACHE.set(key, hit);
  }
  return hit;
}

module.exports = {
  encodeStableId
};
