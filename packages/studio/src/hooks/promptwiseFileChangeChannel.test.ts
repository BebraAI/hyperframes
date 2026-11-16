// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { promptwiseFileChangeChannel } from "./promptwiseFileChangeChannel";

// promptwise-web: a change feed held open on its Service Worker kept new deploys from taking over and was stopped
// by Chrome after five minutes, after which Studio's requests went past the worker.
it("takes promptwise's worker changes from its own page's messages, and nothing else", () => {
  const delivered: unknown[] = [];
  const stop = promptwiseFileChangeChannel((change) => delivered.push(change));
  const change = { path: "index.html", version: '"sha256:abc"', projectId: "d1" };
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: location.origin,
      data: { type: "promptwise:file-change", change },
    }),
  );
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: "https://elsewhere.test",
      data: { type: "promptwise:file-change", change },
    }),
  );
  window.dispatchEvent(
    new MessageEvent("message", { origin: location.origin, data: { type: "promptwise:folder" } }),
  );
  stop();
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: location.origin,
      data: { type: "promptwise:file-change", change },
    }),
  );
  expect(delivered).toEqual([change]);
});
