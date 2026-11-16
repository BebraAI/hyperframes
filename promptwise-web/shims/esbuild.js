// The bundler only uses esbuild to drop comments from authored scripts; the spike keeps them.
export const transform = async (code) => ({ code, map: "" });
export const buildSync = () => {
  throw new Error("esbuild is not in the browser");
};
export default { transform, buildSync };
