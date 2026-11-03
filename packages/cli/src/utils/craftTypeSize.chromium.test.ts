// Real-Chromium pins for the type-size craft warnings: text_below_floor, headline_small and
// hero_word_narrow measure what the page renders. Skipped without a local Chrome; opt-in on Windows.
import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findSystemBrowser } from "../browser/manager.js";
import { createPageDriver } from "./checkBrowser.js";
import { DEFAULT_CHECK_OPTIONS, runAuditGrid } from "./checkPipeline.js";

function resolveExecutable(): string | undefined {
  for (const name of ["HYPERFRAMES_BROWSER_PATH", "PUPPETEER_EXECUTABLE_PATH"]) {
    const candidate = process.env[name];
    if (candidate && existsSync(candidate)) return candidate;
  }
  return findSystemBrowser()?.executablePath;
}

const executablePath = resolveExecutable();
const RUNS_CHROMIUM =
  !!executablePath &&
  (process.platform !== "win32" || process.env.HYPERFRAMES_BROWSER_TESTS === "1");
const BROWSER_LAUNCH_TIMEOUT_MS = 120_000;
const TYPE_CODES = new Set(["text_below_floor", "headline_small", "hero_word_narrow"]);

// A 4 s 1080p film whose text slides a little each second, so nothing reads as a dead stretch.
function film(body: string, rootAttributes = ""): string {
  return `<!doctype html><html><head><style>
    html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #0a0a0a; }
    #root { position: absolute; inset: 0; color: #fff; font-family: sans-serif; }
    #stage { position: absolute; left: 120px; top: 200px; }
    p { margin: 0 0 24px; font-weight: 700; white-space: nowrap; }
  </style></head><body>
    <div id="root" data-composition-id="main" data-duration="4" data-width="1920" data-height="1080" ${rootAttributes}>
      <div id="stage">${body}</div>
    </div>
    <script>
      const seek = (t) => { document.getElementById("stage").style.transform = "translateX(" + t * 10 + "px)"; };
      window.__hf = { duration: 4, seek };
      seek(0);
    </script>
  </body></html>`;
}

describe.skipIf(!RUNS_CHROMIUM)("type size in Chromium", () => {
  let browser: Browser;

  beforeAll(async () => {
    const puppeteer = await import("puppeteer-core");
    browser = await puppeteer.default.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
  }, BROWSER_LAUNCH_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  async function typeFindings(html: string) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setContent(html);
      const result = await runAuditGrid(
        createPageDriver(page),
        { ...DEFAULT_CHECK_OPTIONS, contrast: false },
        { kind: "none" },
      );
      return result.craft.findings
        .filter((finding) => TYPE_CODES.has(finding.code))
        .map(({ code, text, fontPx, widthPx }) => ({ code, text, fontPx, widthPx }));
    } finally {
      await page.close();
    }
  }

  it("flags a 20 px title", async () => {
    const findings = await typeFindings(
      film(`<p style="font-size: 20px">Our quarterly results</p>`),
    );
    expect(findings).toEqual([
      { code: "text_below_floor", text: "Our quarterly results", fontPx: 20, widthPx: undefined },
    ]);
  });

  it("flags a 40 px headline over 30 px reading text", async () => {
    const findings = await typeFindings(
      film(`<p style="font-size: 40px">Our quarterly results</p>
            <p style="font-size: 30px">Revenue grew in every region</p>`),
    );
    expect(findings).toEqual([
      { code: "headline_small", text: "Our quarterly results", fontPx: 40, widthPx: undefined },
    ]);
  });

  it("flags a kinetic hero word under 60% of the width", async () => {
    const [finding] = await typeFindings(
      film(`<p style="font-size: 200px">GO</p>`, "data-kinetic-type"),
    );
    expect(finding).toMatchObject({ code: "hero_word_narrow", text: "GO", fontPx: 200 });
    expect(finding?.widthPx).toBeLessThan(1152);
  });

  it("stays quiet on a 96 px headline, 32 px reading text and a kinetic hero that fills the width", async () => {
    expect(
      await typeFindings(
        film(`<p style="font-size: 96px">Our quarterly results</p>
              <p style="font-size: 32px">Revenue grew in every region</p>`),
      ),
    ).toEqual([]);
    expect(
      await typeFindings(film(`<p style="font-size: 260px">MOMENTUM</p>`, "data-kinetic-type")),
    ).toEqual([]);
  });
});
