import { studioApiFetch } from "../utils/studioApiFetch";
import type { ModelContextTool } from "../webmcp/types";

/** What promptwise's agent gets back from a call: the tool's result as JSON text, and a frame as an image. */
export type PromptwiseCallResult =
  | {
      content: (
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      )[];
    }
  | { error: string };

export interface PromptwiseCall {
  callId: string;
  tool: string;
  args: object;
}

/** promptwise's call to one of Studio's tools, from its page; null for any other message. */
export function promptwiseCall(data: unknown): PromptwiseCall | null {
  if (typeof data !== "object" || data === null) return null;
  const { type, callId, tool, args } = data as Record<string, unknown>;
  if (type !== "promptwise:studio-call" || typeof callId !== "string" || typeof tool !== "string")
    return null;
  return { callId, tool, args: typeof args === "object" && args !== null ? args : {} };
}

async function asBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Runs one of Studio's agent tools for promptwise's agent, which works from a server and can't open
 * Studio's frame URLs: studio_frame's picture comes back as an image beside the result.
 */
export async function runPromptwiseCall(
  tools: readonly ModelContextTool[],
  call: PromptwiseCall,
  fetchFrame: (url: string) => Promise<Response> = studioApiFetch,
): Promise<PromptwiseCallResult> {
  const tool = tools.find((t) => t.name === call.tool);
  if (!tool) return { error: `Studio has no tool ${call.tool}.` };
  try {
    const value = (await tool.execute(call.args)) as { ok?: unknown; url?: unknown } | null;
    const content: Extract<PromptwiseCallResult, { content: unknown }>["content"] = [
      { type: "text", text: JSON.stringify(value) },
    ];
    if (call.tool === "studio_frame" && value?.ok === true && typeof value.url === "string") {
      const res = await fetchFrame(value.url);
      const blob = res.ok ? await res.blob() : null;
      if (blob && /^image\/(png|jpeg|webp)$/.test(blob.type))
        content.push({ type: "image", data: await asBase64(blob), mimeType: blob.type });
    }
    return { content };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
