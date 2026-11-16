export const createRequire = () => (id) => {
  throw new Error(`require(${id}) is not available in the browser`);
};
export default { createRequire };
