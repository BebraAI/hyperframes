import { Buffer } from "buffer";
import process from "process";
globalThis.Buffer ??= Buffer;
globalThis.process ??= process;
process.env ??= {};
process.cwd ??= () => "/";
process.platform ??= "linux";
process.versions ??= { node: "22.0.0" };
// Studio's history yields with setImmediate, which browsers don't have.
globalThis.setImmediate ??= (fn, ...args) => setTimeout(fn, 0, ...args);
globalThis.clearImmediate ??= (id) => clearTimeout(id);

// The buffer polyfill has no base64url, which Node's Buffer has and Studio's backup journal uses.
const toString = Buffer.prototype.toString;
Buffer.prototype.toString = function (encoding, ...rest) {
  if (encoding !== "base64url") return toString.call(this, encoding, ...rest);
  return toString
    .call(this, "base64", ...rest)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};
const from = Buffer.from;
Buffer.from = function (value, encoding, ...rest) {
  if (encoding !== "base64url" || typeof value !== "string")
    return from.call(this, value, encoding, ...rest);
  return from.call(this, value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
};
