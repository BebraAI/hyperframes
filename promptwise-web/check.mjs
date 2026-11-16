// Checks the build in a real browser on two origins, as promptwise runs it: the "tab" (http://localhost:4110) holds
// a folder in memory and answers Studio's folder requests; Studio (4111) is dist/ at /studio/, with
// /studio/<uuid>/... rewritten to /studio/.... Use Chrome: some embedded browsers can't register Service Workers.
//   node check.mjs dist <files.json>   (files.json: {"index.html": "<html>...", ...}, the folder's text files)
// In the tab's console, `tabFiles` is the folder: change a file there to play the agent, and "tab asked" logs
// what Studio asked for.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
const [dist, filesJson] = process.argv.slice(2);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
createServer((req, res) => {
  let path = new URL(req.url, "http://x").pathname.replace(
    /^\/studio\/[0-9a-f-]{36}\//,
    "/studio/",
  );
  if (path === "/studio/") path = "/studio/index.html";
  const file = join(dist, path.replace(/^\/studio\//, ""));
  if (!path.startsWith("/studio/") || !existsSync(file) || statSync(file).isDirectory())
    return res.writeHead(404).end("not found");
  res
    .writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "service-worker-allowed": "/studio/",
    })
    .end(readFileSync(file));
}).listen(4111);
const doc = "11111111-2222-4333-8444-555555555555";
const host = `<!doctype html><meta charset=utf-8><title>tab</title><body style="margin:0">
<iframe id=s src="http://localhost:4111/studio/${doc}/#project/${doc}" style="border:0;width:100vw;height:100vh"></iframe>
<script type=module>
const files = new Map(Object.entries(await (await fetch("/files.json")).json()));
const sha1 = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
window.tabFiles = files; window.asked = [];
addEventListener("message", async (event) => {
  if (event.origin !== "http://localhost:4111" || event.data?.type !== "promptwise:folder") return;
  const r = event.data.request, port = event.ports[0];
  asked.push(r.op + " " + (r.path ?? "")); console.log("tab asked", r.op, r.path ?? "");
  if (r.op === "list") return port.postMessage({ status: 200, files: await Promise.all([...files].map(async ([path, t]) => ({ path, sha1: await sha1(t), url: null }))) });
  const t = files.get(r.path);
  if (r.op === "read") return port.postMessage(t === undefined ? { status: 404 } : { status: 200, content: t });
  if ((t === undefined ? null : await sha1(t)) !== r.base) return port.postMessage({ status: 412 });
  if (r.op === "remove") { files.delete(r.path); return port.postMessage({ status: 204 }); }
  files.set(r.path, r.content); port.postMessage({ status: 200, sha1: await sha1(r.content) });
});
</script>`;
createServer((req, res) =>
  req.url === "/files.json"
    ? res.writeHead(200, { "content-type": "application/json" }).end(readFileSync(filesJson))
    : res.writeHead(200, { "content-type": "text/html" }).end(host),
).listen(4110);
console.log("tab http://localhost:4110  studio http://localhost:4111/studio/");
