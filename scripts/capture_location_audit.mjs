import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = process.env.GRAPH_SCREENSHOT_BASE_URL || "http://127.0.0.1:4173";
const beforeCatalog = process.env.GRAPH_LOCATION_BEFORE_CATALOG;
const afterCatalog = process.env.GRAPH_LOCATION_AFTER_CATALOG;
const outputDirectory = path.resolve(process.env.GRAPH_SCREENSHOT_OUTPUT_DIR || path.join(repositoryRoot, "screenshots"));

if (!beforeCatalog || !afterCatalog) {
  throw new Error("GRAPH_LOCATION_BEFORE_CATALOG and GRAPH_LOCATION_AFTER_CATALOG are required");
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();

try {
  for (const auditCase of [
    { id: "before", catalog: beforeCatalog, expectsVarginha: false },
    { id: "after", catalog: afterCatalog, expectsVarginha: true },
  ]) {
    const context = await browser.newContext({
      colorScheme: "light",
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const catalog = await readFile(auditCase.catalog);
    await page.route("**/data/catalog.json", route => route.fulfill({
      body: catalog,
      contentType: "application/json",
      status: 200,
    }));

    const response = await page.goto(baseURL, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`Graph builder returned ${response?.status() || "no response"}`);
    await page.locator("#loadingState").waitFor({ state: "detached" });
    await page.locator('[data-type="map"]').click();
    await page.waitForFunction(() => Boolean(window.ufoGlobe) && !document.querySelector("#mapStatus")?.textContent?.startsWith("Loading"));
    if (await page.locator("#control-labels").inputValue() !== "top") {
      throw new Error("Map screenshots must retain the default Most important label setting");
    }
    await page.waitForFunction(
      expected => window.ufoGlobe.nodes.some(node => node.userData.name === "Varginha, Brazil") === expected,
      auditCase.expectsVarginha,
    );
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator(".stage").screenshot({
      animations: "disabled",
      path: path.join(outputDirectory, `location-map-audit-${auditCase.id}.png`),
      type: "png",
    });
    await context.close();
  }
} finally {
  await browser.close();
}
