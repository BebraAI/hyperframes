// fallow-ignore-file complexity
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openProject, PULL_MS } from "./backend";
import { folder, type FolderRequest, type FolderReply } from "./folder";

// promptwise is the outside world here: a fake tab over a folder that takes writes only over the version it has, as
// the studio/files routes do, and records what it was asked.
const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");
let texts: Map<string, string>;
let asked: string[];
const tab = async (request: FolderRequest): Promise<FolderReply> => {
  asked.push(request.op === "list" ? "list" : `${request.op} ${request.path}`);
  if (request.op === "list") {
    const files = [...texts].map(([path, text]) => ({ path, sha1: sha1(text), url: null }));
    return {
      status: 200,
      files: [
        ...files,
        { path: "assets/clip.mp4", sha1: "a".repeat(40), url: "https://media.test/clip.mp4" },
      ],
    };
  }
  const text = texts.get(request.path);
  if (request.op === "read")
    return text === undefined ? { status: 404 } : { status: 200, content: text };
  if ((text === undefined ? null : sha1(text)) !== request.base) return { status: 412 };
  if (request.op === "remove") texts.delete(request.path);
  else texts.set(request.path, request.content);
  return { status: 200, sha1: request.op === "write" ? sha1(request.content) : undefined };
};

const HTML =
  '<!doctype html><html><body><div data-composition-id="main" data-width="1920" data-height="1080"><h1 id="title">Made to move fast.</h1></div></body></html>';
const open = () =>
  openProject({
    prefix: "/studio/d1",
    projectId: "d1",
    folder: folder(tab),
    runtimeUrl: "https://app.test/runtime.js",
  });
const at = (path: string, init?: RequestInit) =>
  new Request(`https://studio.test/studio/d1/api${path}`, init);

describe("Studio's API over a tab's folder", () => {
  beforeEach(() => {
    texts = new Map([["index.html", HTML]]);
    asked = [];
  });

  it("serves the folder's files and a preview with its <base> under the page's folder", async () => {
    const studio = await open();
    expect(await (await studio.fetch(at("/projects/d1/files/index.html"))).text()).toContain(
      "Made to move fast.",
    );
    const preview = await (await studio.fetch(at("/projects/d1/preview"))).text();
    expect(preview).toContain('<base href="/studio/d1/api/projects/d1/preview/">');
    expect(preview).toContain('src="/studio/d1/api/runtime.js"');
  });

  it("links binary files to promptwise's copy instead of holding them", async () => {
    const studio = await open();
    const clip = await studio.fetch(at("/projects/d1/preview/assets/clip.mp4"));
    expect([clip.status, clip.headers.get("location")]).toEqual([
      302,
      "https://media.test/clip.mp4",
    ]);
    expect(asked).not.toContain("read assets/clip.mp4");
  });

  it("sends Studio's write over the version it read, and Studio's own notes stay in the page", async () => {
    const studio = await open();
    const edited = HTML.replace("Made to move fast.", "Launch day is here");
    const res = await studio.fetch(
      at("/projects/d1/files/index.html", {
        method: "PUT",
        body: edited,
        headers: { "if-match": await versionOf(studio) },
      }),
    );
    expect(res.status).toBeLessThan(300);
    expect(texts.get("index.html")).toBe(edited);
    expect([...texts.keys()].filter((path) => path.startsWith(".hyperframes/"))).toEqual([]);
  });

  it("takes promptwise's copy when the agent changed the file meanwhile, and tells Studio", async () => {
    const studio = await open();
    const feed = (await studio.fetch(at("/events"))).body!.getReader();
    await feed.read(); // ": open"
    const version = await versionOf(studio);
    texts.set("index.html", HTML.replace("Made to move fast.", "The agent's line"));
    await studio.fetch(
      at("/projects/d1/files/index.html", {
        method: "PUT",
        body: HTML.replace("fast", "slow"),
        headers: { "if-match": version },
      }),
    );

    expect(texts.get("index.html")).toContain("The agent's line");
    expect(await (await studio.fetch(at("/projects/d1/files/index.html"))).text()).toContain(
      "The agent's line",
    );
    const event = new TextDecoder().decode((await feed.read()).value);
    expect(event).toMatch(
      /^event: file-change\ndata: \{"path":"index.html","version":"\\"sha256:[0-9a-f]{64}\\"","projectId":"d1"/,
    );
    await feed.cancel();
  });

  it("takes in the agent's changes on a refresh: new, changed and deleted files", async () => {
    texts.set("old.html", "<p>old</p>");
    const studio = await open();
    texts.set("index.html", HTML.replace("fast", "far"));
    texts.set("scenes/new.html", "<p>new</p>");
    texts.delete("old.html");
    await studio.refresh();
    expect(await (await studio.fetch(at("/projects/d1/files/index.html"))).text()).toContain(
      "Made to move far.",
    );
    expect(
      (await (await studio.fetch(at("/projects/d1/files/scenes/new.html"))).json()).content,
    ).toBe("<p>new</p>");
    expect((await studio.fetch(at("/projects/d1/files/old.html"))).status).toBe(404);
  });

  it("looks for changes once every PULL_MS however many streams Studio opens, and stops when they close", async () => {
    vi.useFakeTimers();
    const studio = await open();
    const feeds = await Promise.all(
      [1, 2, 3].map(async () => (await studio.fetch(at("/events"))).body!.getReader()),
    );
    asked.length = 0;
    await vi.advanceTimersByTimeAsync(PULL_MS * 2);
    expect(asked).toEqual(["list", "list"]);
    await Promise.all(feeds.map((feed) => feed.cancel()));
    await vi.advanceTimersByTimeAsync(PULL_MS * 2);
    expect(asked).toEqual(["list", "list"]);
    vi.useRealTimers();
  });

  it("refuses uploads, which go through promptwise's media", async () => {
    const studio = await open();
    expect(
      (await studio.fetch(at("/projects/d1/upload", { method: "POST", body: "x" }))).status,
    ).toBe(501);
  });
});

/** The version Studio's API gives the file, as Studio reads it before writing. */
async function versionOf(studio: Awaited<ReturnType<typeof open>>): Promise<string> {
  return (await studio.fetch(at("/projects/d1/files/index.html"))).headers.get("etag") ?? "";
}
