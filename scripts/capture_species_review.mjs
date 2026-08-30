#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = process.env.GRAPH_SCREENSHOT_BASE_URL || "http://127.0.0.1:4173";
const outputDirectory = path.resolve(
  process.env.GRAPH_SCREENSHOT_OUTPUT_DIR || path.join(repositoryRoot, "screenshots")
);
const reviewTarget = process.env.SPECIES_REVIEW_TARGET || "men_in_black";
console.log(`Capturing species review to ${outputDirectory}`);
const url = new URL(baseURL);

async function ready(page) {
  console.log("Loading species review URL");
  const response = await page.goto(url.href, { waitUntil: "networkidle" });
  console.log("Loaded species review URL");
  if (!response?.ok()) throw new Error(`Graph builder returned ${response?.status() || "no response"}`);
  await page.locator("#loadingState").waitFor({ state: "detached" });
  console.log("Catalog loaded");
  const activeType = await page.locator("[data-type].active").getAttribute("data-type");
  console.log(`Active graph after load: ${activeType || "none"}`);
  if (activeType !== "species") {
    await page.locator('[data-type="species"]').evaluate(button => button.click());
  }
  await page.waitForFunction(() => document.querySelector('[data-type="species"]')?.classList.contains("active"));
  console.log("Species view active");
  const target = page.locator(`[data-class-id="${reviewTarget}"]`);
  if (await target.count() !== 1) {
    throw new Error(`Species review target was not found: ${reviewTarget}`);
  }
  await page.evaluate(targetId => {
    const wrap = document.querySelector("#chartWrap");
    const target = document.querySelector(`[data-class-id="${targetId}"]`);
    wrap.scrollLeft = Math.max(0, target.getBBox().x - wrap.clientWidth * .5);
  }, reviewTarget);
  await page.evaluate(async () => {
    const sources = [...document.querySelectorAll(".species-lineup-figure")].map(image =>
      new URL(image.href?.baseVal || image.getAttribute("href"), document.baseURI).href
    );
    const responses = await Promise.all(sources.map(source => fetch(source)));
    const failed = responses.find(response => !response.ok);
    if (failed) throw new Error(`Failed to load lineup asset: ${failed.url}`);
    await Promise.all(responses.map(response => response.arrayBuffer()));
  });
  console.log("Lineup assets loaded");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  console.log("Review frame ready");
}

async function capture(page, filename) {
  await ready(page);
  await page.screenshot({
    animations: "disabled",
    path: path.join(outputDirectory, filename),
    type: "png"
  });
}

const browser = await chromium.launch();
console.log("Browser launched");
try {
  const desktop = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 }
  });
  const desktopPage = await desktop.newPage();
  const reviewVersion = reviewTarget === "skinny_bob" ? "v5" : "v3";
  await capture(desktopPage, `species-${reviewTarget.replaceAll("_", "-")}-${reviewVersion}-desktop.png`);
  console.log("Captured desktop species review");
  await desktop.close();
  const mobile = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 }
  });
  const mobilePage = await mobile.newPage();
  await capture(mobilePage, `species-${reviewTarget.replaceAll("_", "-")}-${reviewVersion}-mobile.png`);
  console.log("Captured mobile species review");
  await mobile.close();
} finally {
  await browser.close();
}
