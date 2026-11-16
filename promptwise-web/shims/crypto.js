import createHashImpl from "create-hash";
export const createHash = (alg) => createHashImpl(alg);
export const randomUUID = () => globalThis.crypto.randomUUID();
export const randomBytes = (n) => {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return Buffer.from(b);
};
export default { createHash, randomUUID, randomBytes };
