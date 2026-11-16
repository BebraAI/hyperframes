// The CLI asks DNS whether a host answers before a background request; in the browser fetch finds that out itself.
class Resolver {
  resolve4 = async () => ["0.0.0.0"];
  resolve6 = async () => ["::"];
}
export const promises = { Resolver };
export default { promises };
