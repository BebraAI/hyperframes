// One request at a time in this backend, so the store is the last one entered.
export class AsyncLocalStorage {
  run(store, fn, ...a) {
    const prev = this.s;
    this.s = store;
    try {
      return fn(...a);
    } finally {
      this.s = prev;
    }
  }
  getStore() {
    return this.s;
  }
}
export default { AsyncLocalStorage };
