function pickAllowedObject(input, allowedKeys) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  (Array.isArray(allowedKeys) ? allowedKeys : []).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  });
  return out;
}

module.exports = {
  pickAllowedObject
};
