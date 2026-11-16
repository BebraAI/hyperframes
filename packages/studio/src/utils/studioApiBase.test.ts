import { describe, expect, it } from "vitest";
import { studioApiBase } from "./studioApiBase";

describe("studioApiBase", () => {
  it("is /api for the CLI's build, served at the root", () => {
    expect(studioApiBase("/", "http://localhost:3002/#project/demo")).toBe("/api");
  });

  it("is beside the page for a relative build, wherever the page is served", () => {
    expect(studioApiBase("./", "https://app.test/studio/p1/#project/d1")).toBe("/studio/p1/api");
    expect(studioApiBase("./", "https://app.test/studio/p1/index.html?x=1")).toBe("/studio/p1/api");
  });
});
