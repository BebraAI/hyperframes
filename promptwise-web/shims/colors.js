// The CLI's terminal colors, which `add` uses for its own messages: plain text in the browser.
const plain = new Proxy((text) => text, { get: () => plain });
export const c = plain;
