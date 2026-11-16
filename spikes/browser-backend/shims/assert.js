const assert = (ok, message) => {
  if (!ok) throw new Error(message || "assertion failed");
};
assert.ok = assert;
assert.strictEqual = (a, b, m) => assert(a === b, m);
assert.equal = (a, b, m) => assert(a == b, m);
export default assert;
export const ok = assert,
  strictEqual = assert.strictEqual,
  equal = assert.equal;
