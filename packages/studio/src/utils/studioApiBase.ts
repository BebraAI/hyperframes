/**
 * Where Studio's API is: `/api` beside the page, as the CLI serves it. A build with a relative base (`vite build
 * --base ./`) finds it beside wherever the page is served, as promptwise serves Studio at `/studio/<project>/`.
 * Node (the dev server's config, which imports some of Studio) has no `import.meta.env`: `/api` there.
 */
export const STUDIO_API = studioApiBase(
  import.meta.env?.BASE_URL ?? "/",
  globalThis.document?.baseURI,
);

export function studioApiBase(base: string, documentUrl?: string): string {
  return base.startsWith("/") || !documentUrl
    ? `${base}api`
    : new URL(`${base}api`, documentUrl).pathname;
}
