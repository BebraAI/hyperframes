import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/projectConfig.js", () => ({
  loadProjectConfig: () => ({ registry: "https://example.com/registry" }),
}));
vi.mock("../registry/resolver.js", () => ({
  listRegistryItems: async () => [
    { name: "a", type: "hyperframes:block" },
    { name: "b", type: "hyperframes:component" },
    { name: "c", type: "hyperframes:example" },
  ],
  loadAllItems: async (entries: unknown[]) => entries,
}));
const fetchHiddenItems = vi.fn(async (_baseUrl: string) => ["b"]);
vi.mock("../registry/remote.js", () => ({ fetchHiddenItems }));

const { listStudioCatalog } = await import("./studioCatalog.js");

describe("listStudioCatalog", () => {
  it("lists the registry's blocks and components without what its promptwise.json hides", async () => {
    const items = await listStudioCatalog("/project");
    expect(items).toEqual([{ name: "a", type: "hyperframes:block" }]);
    expect(fetchHiddenItems).toHaveBeenCalledWith("https://example.com/registry");
  });
});
