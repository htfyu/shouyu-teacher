import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const playwright = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const chromium = playwright.chromium || playwright.default?.chromium;
const base = process.env.SHOUYU_BASE || "http://127.0.0.1:5598/";
const port = 9229;
const errors = [];
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"]
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

try {
  await page.goto(`${base}#/course/course-0159`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.locator('.work-context-actions [data-action="course-start-prep"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-action="studio-wizard-next"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-action="studio-wizard-next"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-action="studio-wizard-generate"]').click();
  await page.waitForTimeout(2400);
  await page.goto(`${base}#/studio`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const detector = path.join(ROOT, ".dsh", "skills", "impeccable", "scripts", "impeccable.cmd");
  const scan = (name) => {
    const result = spawnSync("cmd.exe", ["/c", detector, "detect", "--cdp", String(port), "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120000
    });
    const outPath = path.join(ROOT, "资料", `impeccable-${name}-cdp.json`);
    fs.writeFileSync(outPath, result.stdout || "", "utf8");
    let findings = [];
    try { findings = JSON.parse(result.stdout || "[]"); } catch (error) { findings = []; }
    return { ok: result.status === 0, detectorExit: result.status, findings: Array.isArray(findings) ? findings.length : -1, stderr: String(result.stderr || "").slice(0, 800), path: outPath };
  };
  const studio = scan("studio");
  await page.goto(`${base}#/quality`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const quality = scan("quality");
  console.log(JSON.stringify({
    ok: studio.ok && quality.ok,
    studio,
    quality,
    errors
  }, null, 2));
  if (!studio.ok || !quality.ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}