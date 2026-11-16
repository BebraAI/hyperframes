// No processes in a browser: what needs ffmpeg or Chrome answers with this error.
const none = () => {
  throw new Error("not available in the browser");
};
export const execFile = none,
  execFileSync = none,
  spawn = none,
  spawnSync = none,
  execSync = none,
  exec = none;
export default { execFile, execFileSync, spawn, spawnSync, execSync, exec };
