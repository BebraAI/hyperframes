import { pipeline as p } from "readable-stream";
export const pipeline = (...a) => new Promise((ok, bad) => p(...a, (e) => (e ? bad(e) : ok())));
export default { pipeline };
