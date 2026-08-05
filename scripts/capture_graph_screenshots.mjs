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
const defaultScreenshot = {
  id: "default-view",
  label: "Default view"
};
const farSideScreenshot = {
  id: "far-side-moon",
  label: "Far Side of the Moon"
};

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function galleryMarkup(graphTypes) {
  const galleryItems = [
    ...graphTypes.map(({ id, label }) => ({
      id,
      label,
      alt: `${label} graph type screenshot`
    })),
    {
      ...farSideScreenshot,
      alt: "Far Side of the Moon map screenshot"
    }
  ];
  const rows = [];
  for (let index = 0; index < galleryItems.length; index += 2) {
    const cells = galleryItems.slice(index, index + 2).map(({ id, label, alt }) => `    <td width="50%" align="center">
      <strong>${escapeHTML(label)}</strong><br>
      <a href="assets/screenshots/${escapeHTML(id)}.png"><img src="assets/screenshots/${escapeHTML(id)}.png" alt="${escapeHTML(alt)}" width="100%"></a>
    </td>`);
    if (cells.length === 1) cells.push('    <td width="50%"></td>');
    rows.push(`  <tr>\n${cells.join("\n")}\n  </tr>`);
  }
  return `${galleryStart}
<p align="center">
  <strong>${defaultScreenshot.label}</strong><br>
  <a href="assets/screenshots/${defaultScreenshot.id}.png"><img src="assets/screenshots/${defaultScreenshot.id}.png" alt="Default graph builder view screenshot" width="100%"></a>
</p>
<table>\n${rows.join("\n")}\n</table>\n${galleryEnd}`;
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
    content: `body.screenshot-default::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        box-sizing: border-box;
        border: 1px solid #000;
        pointer-events: none;
      }
      body.screenshot-graph .stage { position: relative !important; }
      body.screenshot-graph .stage::after {
        content: "";
        position: absolute;
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

  const expectedFiles = new Set([
    `${defaultScreenshot.id}.png`,
    `${farSideScreenshot.id}.png`,
    ...graphTypes.map(({ id }) => `${id}.png`)
  ]);
  for (const existingFile of await readdir(outputDirectory)) {
    if (existingFile.endsWith(".png") && !expectedFiles.has(existingFile)) {
      await rm(path.join(outputDirectory, existingFile));
    }
  }

  await page.evaluate(() => document.body.classList.add("screenshot-default"));
  await page.screenshot({
    animations: "disabled",
    fullPage: false,
    path: path.join(outputDirectory, `${defaultScreenshot.id}.png`),
    type: "png"
  });
  await page.evaluate(() => {
    document.body.classList.remove("screenshot-default");
    document.body.classList.add("screenshot-graph");
  });

  for (const { id } of graphTypes) {
    await page.locator(`[data-type="${id}"]`).click();
    await page.waitForFunction(type => document.querySelector(`[data-type="${type}"]`)?.classList.contains("active"), id);
    if (id === "map") {
      await page.waitForFunction(() => !document.querySelector("#mapStatus")?.textContent?.startsWith("Loading"));
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator(".stage").screenshot({
      animations: "disabled",
      path: path.join(outputDirectory, `${id}.png`),
      type: "png"
    });
  }

  await page.locator('[data-type="map"]').click();
  await page.waitForFunction(() => Boolean(window.ufoGlobe));
  await page.evaluate(() => {
    const farSideName = "Far Side of the Moon";
    const current = window.pendingGlobeRender;
    if (!window.ufoGlobe.nodes.some(node => node.userData.name === farSideName)) {
      const items = current.items.filter(item => item.name !== farSideName);
      items.splice(1, 0, {
        id: "far-side-moon-preview",
        name: farSideName,
        lat: 0,
        lon: 180,
        body: "moon",
        precision: "selenographic-region",
        intensity: .2,
        formattedValue: "Mapped lunar hemisphere",
        secondary: false,
        showLabel: true
      });
      window.dispatchEvent(new CustomEvent("ufo-map-render", { detail: { ...current, items } }));
    }
    window.ufoGlobe.moonOrbit.rotation.y = Math.PI * 3 / 2;
    window.ufoGlobe.draw();
  });
  await page.waitForFunction(() => {
    const node = window.ufoGlobe?.nodes.find(item => item.userData.name === "Far Side of the Moon");
    const label = window.ufoGlobe?.labels.find(item => item.node === node)?.label;
    return Boolean(node && label && !label.hidden);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator(".stage").screenshot({
    animations: "disabled",
    path: path.join(outputDirectory, `${farSideScreenshot.id}.png`),
    type: "png"
  });

  if (pageErrors.length) throw pageErrors[0];
  if (updateReadme) await updateGallery(graphTypes);
} finally {
  await browser.close();
}
