import { describe, expect, it } from "vitest";
import type { ModelContextTool } from "../webmcp/types";
import { promptwiseCall, runPromptwiseCall } from "./agentCalls";

const tool = (name: string, execute: ModelContextTool["execute"]): ModelContextTool => ({
  name,
  description: name,
  execute,
});

describe("promptwiseCall", () => {
  it("reads promptwise's call and nothing else", () => {
    expect(
      promptwiseCall({
        type: "promptwise:studio-call",
        callId: "c1",
        tool: "studio_look",
        args: { limit: 2 },
      }),
    ).toEqual({ callId: "c1", tool: "studio_look", args: { limit: 2 } });
    expect(
      promptwiseCall({ type: "promptwise:studio-call", callId: "c1", tool: "studio_look" }),
    ).toEqual({
      callId: "c1",
      tool: "studio_look",
      args: {},
    });
    expect(promptwiseCall({ type: "promptwise:command", command: "undo" })).toBeNull();
    expect(promptwiseCall("promptwise:studio-call")).toBeNull();
  });
});

describe("runPromptwiseCall", () => {
  it("runs the named tool and returns its result as JSON text", async () => {
    const seen: object[] = [];
    const tools = [
      tool("studio_set_text", async (input) => {
        seen.push(input);
        return { ok: true, text: "Hi", changed: true };
      }),
    ];
    const result = await runPromptwiseCall(tools, {
      callId: "c1",
      tool: "studio_set_text",
      args: { handle: "h", text: "Hi" },
    });
    expect(seen).toEqual([{ handle: "h", text: "Hi" }]);
    expect(result).toEqual({
      content: [{ type: "text", text: '{"ok":true,"text":"Hi","changed":true}' }],
    });
  });

  it("adds studio_frame's picture as an image", async () => {
    const tools = [
      tool("studio_frame", async () => ({ ok: true, url: "/api/frame.png", time: 1 })),
    ];
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const result = await runPromptwiseCall(
      tools,
      { callId: "c1", tool: "studio_frame", args: {} },
      async () => new Response(png),
    );
    expect(result).toEqual({
      content: [
        { type: "text", text: '{"ok":true,"url":"/api/frame.png","time":1}' },
        { type: "image", data: "iVBORw==", mimeType: "image/png" },
      ],
    });
  });

  it("answers with an error for a tool Studio doesn't have, or one that throws", async () => {
    const tools = [
      tool("studio_look", async () => {
        throw new Error("no project");
      }),
    ];
    expect(await runPromptwiseCall(tools, { callId: "c", tool: "studio_nope", args: {} })).toEqual({
      error: "Studio has no tool studio_nope.",
    });
    expect(await runPromptwiseCall(tools, { callId: "c", tool: "studio_look", args: {} })).toEqual({
      error: "no project",
    });
  });
});
