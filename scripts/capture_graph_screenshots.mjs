import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = process.env.GRAPH_SCREENSHOT_BASE_URL || "http://127.0.0.1:4173";
const outputDirectory = path.resolve(
  process.env.GRAPH_SCREENSHOT_OUTPUT_DIR || path.join(repositoryRoot, "assets", "screenshots")
);
const updateReadme = process.env.GRAPH_SCREENSHOT_UPDATE_README !== "false";
const readmePath = path.join(repositoryRoot, "README.md");
const galleryStart = "<!-- graph-screenshots:start -->";
const galleryEnd = "<!-- graph-screenshots:end -->";

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function galleryMarkup(graphTypes) {
  const rows = [];
  for (let index = 0; index < graphTypes.length; index += 2) {
    const cells = graphTypes.slice(index, index + 2).map(({ id, label }) => `    <td width="50%" align="center">
      <strong>${escapeHTML(label)}</strong><br>
      <a href="assets/screenshots/${escapeHTML(id)}.png"><img src="assets/screenshots/${escapeHTML(id)}.png" alt="${escapeHTML(label)} graph type screenshot" width="100%"></a>
    </td>`);
    if (cells.length === 1) cells.push('    <td width="50%"></td>');
    rows.push(`  <tr>\n${cells.join("\n")}\n  </tr>`);
  }
  return `${galleryStart}\n<table>\n${rows.join("\n")}\n</table>\n${galleryEnd}`;
}

async function updateGallery(graphTypes) {
  const readme = await readFile(readmePath, "utf8");
  const start = readme.indexOf(galleryStart);
  const end = readme.indexOf(galleryEnd);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("README screenshot gallery markers are missing or out of order");
  }
  const replacement = galleryMarkup(graphTypes);
  const nextReadme = `${readme.slice(0, start)}${replacement}${readme.slice(end + galleryEnd.length)}`;
  if (nextReadme !== readme) await writeFile(readmePath, nextReadme);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error));

  const response = await page.goto(baseURL, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`Graph builder returned ${response?.status() || "no response"}`);
  await page.locator("#loadingState").waitFor({ state: "detached" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `body::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        box-sizing: border-box;
        border: 1px solid #000;
        pointer-events: none;
      }`
  });

  const graphTypes = await page.locator("[data-type]").evaluateAll(buttons => buttons.map(button => ({
    id: button.dataset.type,
    label: button.querySelector("strong")?.textContent?.trim() || button.textContent.trim()
  })));
  if (!graphTypes.length) throw new Error("No top-level graph types were found");
  if (graphTypes.some(({ id }) => !/^[a-z0-9-]+$/.test(id))) {
    throw new Error("Graph type IDs must contain only lowercase letters, numbers, and hyphens");
  }
  if (new Set(graphTypes.map(({ id }) => id)).size !== graphTypes.length) {
    throw new Error("Graph type IDs must be unique");
  }

  const expectedFiles = new Set(graphTypes.map(({ id }) => `${id}.png`));
  for (const existingFile of await readdir(outputDirectory)) {
    if (existingFile.endsWith(".png") && !expectedFiles.has(existingFile)) {
      await rm(path.join(outputDirectory, existingFile));
    }
  }

  for (const { id } of graphTypes) {
    await page.locator(`[data-type="${id}"]`).click();
    await page.waitForFunction(type => document.querySelector(`[data-type="${type}"]`)?.classList.contains("active"), id);
    if (id === "map") {
      await page.waitForFunction(() => !document.querySelector("#mapStatus")?.textContent?.startsWith("Loading"));
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      animations: "disabled",
      fullPage: false,
      path: path.join(outputDirectory, `${id}.png`),
      type: "png"
    });
  }

  if (pageErrors.length) throw pageErrors[0];
  if (updateReadme) await updateGallery(graphTypes);
} finally {
  await browser.close();
}
