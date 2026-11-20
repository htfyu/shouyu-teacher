import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const playwright = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const chromium = playwright.chromium || playwright.default?.chromium;
const BASE = process.env.SHOUYU_BASE || "http://127.0.0.1:5598/";
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
const errors = [];
const result = { checks: [] };
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

try {
  // P0-2 version consistency
  await page.goto(BASE, { waitUntil: "networkidle" });
  assert.match(await page.title(), /V3\.0/);
  await page.goto(`${BASE}#/guide`, { waitUntil: "networkidle" });
  assert.match(await page.locator(".page-head-side").innerText(), /V3\.0/);
  result.checks.push("P0-2 version V3.0");

  // P0-1 explicit 404, no silent rewrite
  await page.goto(`${BASE}#/a-route-that-does-not-exist`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".notfound-page").count(), 1);
  assert.equal(await page.locator(".notfound-card").count(), 1);
  assert.equal(await page.evaluate(() => location.hash), "#/a-route-that-does-not-exist");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.route), "notfound");
  await page.goBack(); await page.waitForTimeout(200);
  assert.notEqual(await page.evaluate(() => location.hash), "#/a-route-that-does-not-exist");
  await page.goForward(); await page.waitForTimeout(200);
  assert.equal(await page.locator(".notfound-page").count(), 1);
  await page.locator(".notfound-actions .btn-solid").click(); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => location.hash), "#/");
  result.checks.push("P0-1 explicit 404 + back/forward");

  // P0-3 all nav entries are links, only active has aria-current
  await page.locator(".nav-more-toggle").click(); await page.waitForTimeout(200);
  const nav = await page.locator(".side-nav .nav-item").evaluateAll((els) => els.map((el) => ({ tag: el.tagName, href: el.getAttribute("href"), current: el.getAttribute("aria-current") })));
  assert.equal(nav.length, 15); // 14 route entries + AI action entry
  assert.ok(nav.every((item) => item.tag === "A" && item.href?.startsWith("#/")));
  assert.equal(nav.filter((item) => item.current === "page").length, 1);
  result.checks.push(`P0-3 ${nav.length} nav anchors with one aria-current`);

  // 19 interactive sidebar targets (14 routes + AI + prep + brand + more + privacy + collapse)
  const entryCount = await page.locator(".sidebar .brand, .sidebar .new-chat, .sidebar .nav-more-toggle, .sidebar .side-foot-link, .sidebar .sidebar-collapse, .side-nav .nav-item").count();
  assert.equal(entryCount, 20); // 15 items already counted + brand/prep/more/privacy/collapse
  result.checks.push(`sidebar targets reachable: ${entryCount}`);

  // one route click and native hash behaviour
  await page.locator('.side-nav .nav-item[data-nav="courses"]').click(); await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => location.hash), "#/courses");
  await page.goBack(); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => location.hash), "#/");
  result.checks.push("nav route click + history back");

  // P0-4 mobile drawer focus, trap, restore, 44px targets
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
  mobile.on("pageerror", (error) => errors.push(error.message));
  mobile.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await mobile.goto(BASE, { waitUntil: "networkidle" });
  await mobile.locator(".mobile-menu").click(); await mobile.waitForTimeout(300);
  assert.equal(await mobile.locator(".mobile-menu").getAttribute("aria-expanded"), "true");
  assert.match(await mobile.evaluate(() => document.activeElement?.className || ""), /nav-item/);
  const trap = await mobile.evaluate(() => {
    const list = [...document.querySelectorAll(".sidebar a[href],.sidebar button:not([disabled])")].filter((el) => el.offsetParent !== null);
    return { first: list[0]?.className, last: list[list.length - 1]?.className, count: list.length };
  });
  assert.ok(trap.count >= 8);
  await mobile.locator(".sidebar .side-foot-link").focus();
  await mobile.keyboard.press("Tab");
  assert.match(await mobile.evaluate(() => document.activeElement?.className || ""), /brand/);
  await mobile.keyboard.press("Shift+Tab");
  assert.match(await mobile.evaluate(() => document.activeElement?.className || ""), /side-foot-link/);
  await mobile.keyboard.press("Escape"); await mobile.waitForTimeout(250);
  assert.equal(await mobile.locator(".app-shell").evaluate((el) => el.classList.contains("sidebar-open")), false);
  assert.match(await mobile.evaluate(() => document.activeElement?.className || ""), /mobile-menu/);
  const smallTargets = await mobile.evaluate(() => {
    const sel = 'button,a[href],[role="button"],select,summary,input[type="submit"],input[type="button"]';
    return [...document.querySelectorAll(sel)].filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && rect.height < 43.5;
    }).map((el) => ({ tag: el.tagName, cls: el.className, h: el.getBoundingClientRect().height }));
  });
  assert.deepEqual(smallTargets, []);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  result.checks.push("P0-4 focus first item, tab trap, escape restore, 44px targets, no overflow");

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, ...result, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.stack, errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
