// fallow-ignore-file complexity -- Node's fs over memfs for the browser build; exercised through backend.test.ts
// node:fs over one in-memory volume (memfs), which the backend fills with the project files. Generated.
import { Volume, createFsFromVolume } from "memfs";
export const vol = new Volume();
const fs = createFsFromVolume(vol);
export default fs;
export const constants = fs.constants;
export const promises = fs.promises;
export const access = (...a) => fs.access(...a);
export const accessSync = (...a) => fs.accessSync(...a);
export const appendFile = (...a) => fs.appendFile(...a);
export const appendFileSync = (...a) => fs.appendFileSync(...a);
export const chmod = (...a) => fs.chmod(...a);
export const chmodSync = (...a) => fs.chmodSync(...a);
export const chown = (...a) => fs.chown(...a);
export const chownSync = (...a) => fs.chownSync(...a);
export const close = (...a) => fs.close(...a);
export const closeSync = (...a) => fs.closeSync(...a);
export const copyFile = (...a) => fs.copyFile(...a);
export const copyFileSync = (...a) => fs.copyFileSync(...a);
export const createReadStream = (...a) => fs.createReadStream(...a);
export const createWriteStream = (...a) => fs.createWriteStream(...a);
export const exists = (...a) => fs.exists(...a);
export const existsSync = (...a) => fs.existsSync(...a);
export const fchmod = (...a) => fs.fchmod(...a);
export const fchmodSync = (...a) => fs.fchmodSync(...a);
export const fchown = (...a) => fs.fchown(...a);
export const fchownSync = (...a) => fs.fchownSync(...a);
export const fdatasync = (...a) => fs.fdatasync(...a);
export const fdatasyncSync = (...a) => fs.fdatasyncSync(...a);
export const fstat = (...a) => fs.fstat(...a);
export const fstatSync = (...a) => fs.fstatSync(...a);
export const fsync = (...a) => fs.fsync(...a);
export const fsyncSync = (...a) => fs.fsyncSync(...a);
export const ftruncate = (...a) => fs.ftruncate(...a);
export const ftruncateSync = (...a) => fs.ftruncateSync(...a);
export const futimes = (...a) => fs.futimes(...a);
export const futimesSync = (...a) => fs.futimesSync(...a);
export const lchmod = (...a) => fs.lchmod(...a);
export const lchmodSync = (...a) => fs.lchmodSync(...a);
export const lchown = (...a) => fs.lchown(...a);
export const lchownSync = (...a) => fs.lchownSync(...a);
export const link = (...a) => fs.link(...a);
export const linkSync = (...a) => fs.linkSync(...a);
export const lstat = (...a) => fs.lstat(...a);
export const lstatSync = (...a) => fs.lstatSync(...a);
export const lutimes = (...a) => fs.lutimes(...a);
export const lutimesSync = (...a) => fs.lutimesSync(...a);
export const mkdir = (...a) => fs.mkdir(...a);
export const mkdirSync = (...a) => fs.mkdirSync(...a);
export const mkdtemp = (...a) => fs.mkdtemp(...a);
export const mkdtempSync = (...a) => fs.mkdtempSync(...a);
export const open = (...a) => fs.open(...a);
export const openSync = (...a) => fs.openSync(...a);
export const read = (...a) => fs.read(...a);
export const readFile = (...a) => fs.readFile(...a);
export const readFileSync = (...a) => fs.readFileSync(...a);
export const readSync = (...a) => fs.readSync(...a);
export const readdir = (...a) => fs.readdir(...a);
export const readdirSync = (...a) => fs.readdirSync(...a);
export const readlink = (...a) => fs.readlink(...a);
export const readlinkSync = (...a) => fs.readlinkSync(...a);
export const readv = (...a) => fs.readv(...a);
export const readvSync = (...a) => fs.readvSync(...a);
export const realpath = (...a) => fs.realpath(...a);
export const realpathSync = Object.assign((...a) => fs.realpathSync(...a), {
  native: (...a) => fs.realpathSync(...a),
});
export const rename = (...a) => fs.rename(...a);
export const renameSync = (...a) => fs.renameSync(...a);
export const rm = (...a) => fs.rm(...a);
export const rmSync = (...a) => fs.rmSync(...a);
export const rmdir = (...a) => fs.rmdir(...a);
export const rmdirSync = (...a) => fs.rmdirSync(...a);
export const stat = (...a) => fs.stat(...a);
// memfs has no statfs; the CLI only reads it for telemetry.
export const statfsSync = () => ({ bavail: 0, bsize: 0, blocks: 0 });
export const statSync = (...a) => fs.statSync(...a);
export const symlink = (...a) => fs.symlink(...a);
export const symlinkSync = (...a) => fs.symlinkSync(...a);
export const truncate = (...a) => fs.truncate(...a);
export const truncateSync = (...a) => fs.truncateSync(...a);
export const unlink = (...a) => fs.unlink(...a);
export const unlinkSync = (...a) => fs.unlinkSync(...a);
export const unwatchFile = (...a) => fs.unwatchFile(...a);
export const utimes = (...a) => fs.utimes(...a);
export const utimesSync = (...a) => fs.utimesSync(...a);
export const watch = () => ({
  close() {},
  on() {
    return this;
  },
});
export const watchFile = (...a) => fs.watchFile(...a);
export const write = (...a) => fs.write(...a);
export const writeFile = (...a) => fs.writeFile(...a);
// Node takes `mode: undefined` as the default; memfs refuses it ("mode must be an int"), as the core's atomic write passes it.
const withoutUndefinedMode = (options) =>
  options && typeof options === "object" && "mode" in options && options.mode === undefined
    ? Object.fromEntries(Object.entries(options).filter(([key]) => key !== "mode"))
    : options;
export const writeFileSync = (path, data, options) =>
  fs.writeFileSync(path, data, withoutUndefinedMode(options));
export const writeSync = (...a) => fs.writeSync(...a);
export const writev = (...a) => fs.writev(...a);
export const writevSync = (...a) => fs.writevSync(...a);
