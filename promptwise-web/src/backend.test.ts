// fallow-ignore-file complexity
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FileChange, openProject } from "./backend";
import { folder, type FolderRequest, type FolderReply } from "./folder";

// promptwise is the outside world here: a fake tab over a folder that takes writes only over the version it has, as
// the studio/files routes do, and records what it was asked.
const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");
let texts: Map<string, string>;
let asked: string[];
let uploads: Map<string, string>;
let extra: { path: string; sha1: string; url: string }[];
/** Whether the tab gives the text with a listing that asks for it, as promptwise does; an older one doesn't. */
let givesContent: boolean;
const tab = async (request: FolderRequest): Promise<FolderReply> => {
  asked.push(
    request.op === "list"
      ? request.content
        ? "list with content"
        : "list"
      : `${request.op} ${request.path}`,
  );
  if (request.op === "list") {
    const withText = request.content && givesContent;
    const files = [...texts].map(([path, text]) => ({
      path,
      sha1: sha1(text),
      url: null,
      ...(withText ? { content: text } : {}),
    }));
    return {
      status: 200,
      files: [
        ...files,
        { path: "assets/clip.mp4", sha1: "a".repeat(40), url: "https://media.test/clip.mp4" },
        ...extra,
      ],
    };
  }
  if (request.op === "upload") {
    if (request.contentType !== "video/mp4") return { status: 400 };
    uploads.set(request.path, new TextDecoder().decode(request.bytes));
    return { status: 200, sha1: "b".repeat(40), url: `https://media.test/${request.path}` };
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
let changes: FileChange[];
let errors: string[];
let opened: Awaited<ReturnType<typeof openProject>>[] = [];
const open = () =>
  openProject({
    prefix: "/studio/d1",
    projectId: "d1",
    folder: folder(tab),
    runtimeUrl: "https://app.test/runtime.js",
    onChange: (change) => changes.push(change),
    onError: (path, message) => errors.push(`${path}: ${message}`),
  }).then((studio) => (opened.push(studio), studio));
const at = (path: string, init?: RequestInit) =>
  new Request(`https://studio.test/studio/d1/api${path}`, init);

describe("Studio's API over a tab's folder", () => {
  beforeEach(() => {
    texts = new Map([["index.html", HTML]]);
    asked = [];
    uploads = new Map();
    extra = [];
    changes = [];
    errors = [];
    givesContent = true;
  });

  it("opens the folder in one request, and reads each text file where the tab doesn't give the text with it", async () => {
    texts.set("compositions/intro.html", HTML);
    const studio = await open();
    expect(asked).toEqual(["list with content"]);
    expect(
      await (await studio.fetch(at("/projects/d1/files/compositions/intro.html"))).text(),
    ).toContain("Made to move fast.");
    // A later look asks only for the versions.
    await studio.refresh();
    expect(asked).toEqual(["list with content", "list"]);

    asked = [];
    givesContent = false;
    await open();
    expect(asked.sort()).toEqual([
      "list with content",
      "read compositions/intro.html",
      "read index.html",
    ]);
  });
  afterEach(async () => {
    await Promise.all(opened.map((studio) => studio.close()));
    opened = [];
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
    expect(errors).toEqual([
      "index.html: changed in promptwise meanwhile, so Studio's edit gave way to it",
    ]);
    expect(await (await studio.fetch(at("/projects/d1/files/index.html"))).text()).toContain(
      "The agent's line",
    );
    expect(changes).toEqual([
      {
        path: "index.html",
        version: expect.stringMatching(/^"sha256:[0-9a-f]{64}"$/),
        projectId: "d1",
        affectsPreview: true,
        affectedCompositions: null,
      },
    ]);
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
    expect(changes.map((c) => [c.path, c.version === null])).toEqual([
      ["index.html", false],
      ["scenes/new.html", false],
      ["old.html", true],
    ]);
  });

  // A change feed held open on the worker kept new deploys from taking over and was stopped by Chrome after five
  // minutes, after which Studio's requests went past the worker to the host: the backend serves no stream now.
  it("holds no request open: Studio's events route isn't the worker's", async () => {
    const studio = await open();
    const res = await studio.fetch(at("/events"));
    expect(res.headers.get("content-type") ?? "").not.toContain("text/event-stream");
  });

  // Studio's catalog said "Failed to load catalog": the browser backend had no registry at all.
  it("lists the registry's blocks and installs one into the folder, which goes back to the tab", async () => {
    // The registry over HTTPS is the outside world: answered from the fork's own registry/ folder on disk
    // (Node's own fs, since this file's fs is the in-memory one).
    const disk = createRequire(import.meta.url)("fs") as typeof import("node:fs");
    const root = new URL("../../registry/", import.meta.url);
    vi.stubGlobal("fetch", async (url: string) => {
      const path = new URL(url).pathname.split("/registry/")[1]!;
      const file = new URL(path, root);
      return disk.existsSync(file)
        ? new Response(disk.readFileSync(file))
        : new Response("not found", { status: 404 });
    });
    try {
      const studio = await open();
      const catalog = (await (await studio.fetch(at("/registry/blocks"))).json()) as {
        name: string;
      }[];
      expect(catalog.length).toBeGreaterThan(100);
      expect(catalog.map((b) => b.name)).toContain("lt-color-block");

      const res = await studio.fetch(
        at("/projects/d1/registry/install", {
          method: "POST",
          body: JSON.stringify({ blockName: "lt-color-block" }),
          headers: { "content-type": "application/json" },
        }),
      );
      const body = await res.json();
      expect([res.status, body.error]).toEqual([200, undefined]);
      expect(body.written[0]).toBe("compositions/lt-color-block.html");
      expect(texts.get("compositions/lt-color-block.html")).toContain("<");
      expect(texts.get("hyperframes.json")).toContain("lt-color-block");
    } finally {
      vi.unstubAllGlobals();
    }
  }, 30_000);

  // Cmd+Z in Studio did nothing here: the browser backend had no history, so /history answered 404.
  it("undoes Studio's own edit and sends the file back as it was", async () => {
    const studio = await open();
    const edited = HTML.replace("Made to move fast.", "Launch day is here");
    await studio.fetch(
      at("/projects/d1/files/index.html", {
        method: "PUT",
        body: edited,
        headers: { "if-match": await versionOf(studio) },
      }),
    );
    const claim = await studio.fetch(
      at("/projects/d1/history/claim", {
        method: "POST",
        body: JSON.stringify({ label: "Edit title", paths: ["index.html"] }),
        headers: { "content-type": "application/json" },
      }),
    );
    const claimed = await claim.json();
    expect(claimed.claimed).toEqual({ id: expect.any(String) });

    const history = await (await studio.fetch(at("/projects/d1/history"))).json();
    expect(history.back?.label).toBe("Edit title");
    const step = await studio.fetch(
      at("/projects/d1/history/step", {
        method: "POST",
        body: JSON.stringify({ direction: "back" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect((await step.json()).entry?.undoes).toBe(claimed.claimed.id);
    expect(texts.get("index.html")).toBe(HTML);
    expect([...texts.keys()].filter((path) => path.startsWith(".hyperframes/"))).toEqual([]);
  });

  it("tells Studio about a clip added elsewhere, once", async () => {
    const studio = await open();
    extra = [{ path: "assets/new.mp4", sha1: "c".repeat(40), url: "https://media.test/new.mp4" }];
    await studio.refresh();
    await studio.refresh();
    expect(changes.map((change) => change.path)).toEqual(["assets/new.mp4"]);
    const clip = await studio.fetch(at("/projects/d1/preview/assets/new.mp4"));
    expect(clip.headers.get("location")).toBe("https://media.test/new.mp4");
  });

  it("uploads Studio's files through the tab and links them, under a free name", async () => {
    const studio = await open();
    const form = new FormData();
    form.append("file", new File(["new clip"], "clip.mp4", { type: "video/mp4" }));
    form.append("file", new File(["text"], "notes.txt", { type: "text/plain" }));
    const res = await studio.fetch(
      at("/projects/d1/upload?dir=assets", { method: "POST", body: form }),
    );
    const body = await res.json();
    expect([res.status, body.files]).toEqual([201, ["assets/clip (2).mp4"]]);
    expect(body.invalid).toEqual([
      { name: "notes.txt", reason: "promptwise answered 400 to upload" },
    ]);
    expect(uploads.get("assets/clip (2).mp4")).toBe("new clip");
    const clip = await studio.fetch(at("/projects/d1/preview/assets/clip%20(2).mp4"));
    expect(clip.headers.get("location")).toBe("https://media.test/assets/clip%20(2).mp4");
  });
});

/** The version Studio's API gives the file, as Studio reads it before writing. */
async function versionOf(studio: Awaited<ReturnType<typeof open>>): Promise<string> {
  return (await studio.fetch(at("/projects/d1/files/index.html"))).headers.get("etag") ?? "";
}
