import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanTree } from "../scripts/scan-public.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const load = (path) => readFile(new URL(path, new URL("../", import.meta.url)), "utf8");

test("required public documentation is present", async () => {
  const required = ["README.md", "COMPANIONS.md", "CONTRIBUTING.md", "SECURITY.md", "PRIVACY.md", "CUSTOMIZATION.md", "LICENSE", "ASSET_LICENSE.md", "PUBLIC_ASSET_MANIFEST.md", "PUBLIC_RELEASE_SCAN.md"];
  await Promise.all(required.map((name) => access(resolve(root, name))));
});

test("the public interface is English and exposes one live status region", async () => {
  const [html, app, presentation] = await Promise.all([load("index.html"), load("src/app.mjs"), load("src/presentation.mjs")]);
  assert.match(html, /<html lang="en">/);
  assert.equal((html.match(/role="status"|aria-live=/g) || []).length, 1);
  assert.doesNotMatch(`${html}\n${app}\n${presentation}`, /[\u3400-\u9fff\uf900-\ufaff]/u);
  assert.match(html, /id="submitPath"[^>]*disabled/);
  assert.match(html, /id="cancelPath"[^>]*disabled/);
});

test("mobile and accessibility contracts keep touch targets and alternatives", async () => {
  const [css, app] = await Promise.all([load("src/styles.css"), load("src/app.mjs")]);
  assert.match(css, /button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.cell\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/s);
  assert.match(css, /grid-template-columns:\s*repeat\(6,\s*minmax\(44px,\s*1fr\)\)/);
  assert.match(css, /:focus-visible[^}]*outline:\s*3px/s);
  assert.match(app, /event\.key !== "Enter"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(app, /navigator\.vibrate/);
});

test("all runtime assets exist and contain no remote payloads", async () => {
  const assetDirectory = new URL("assets/tiles/", new URL("../", import.meta.url));
  const names = (await readdir(assetDirectory)).sort();
  assert.deepEqual(names, [
    "t001_pebble_dots.svg",
    "t002_cushion_grid.svg",
    "t003_diamond_ripples.svg",
    "t004_hex_honeycomb.svg",
    "t005_flower_stitches.svg"
  ]);
  for (const name of names) {
    const svg = await readFile(new URL(name, assetDirectory), "utf8");
    assert.match(svg, /<title/);
    assert.match(svg, /<desc/);
    assert.doesNotMatch(svg, /<(?:script|image)\b|(?:href|src)\s*=\s*["']https?:/i);
  }
});

test("the two approved companion assets are present with a neutral fallback", async () => {
  const firstName = ["da", "bing", ".png"].join("");
  const secondName = ["yu", "wan", ".png"].join("");
  const companionDirectory = new URL("assets/companions/", new URL("../", import.meta.url));
  assert.deepEqual((await readdir(companionDirectory)).sort(), [firstName, secondName]);
  const [html, app, css] = await Promise.all([load("index.html"), load("src/app.mjs"), load("src/styles.css")]);
  assert.match(html, new RegExp(`assets/companions/${firstName}`));
  assert.match(html, new RegExp(`assets/companions/${secondName}`));
  assert.match(app, /companion-portrait/);
  assert.match(css, /companion-badge\.asset-missing/);
});

test("the static public tree passes the privacy scan", async () => {
  const result = await scanTree(root);
  assert.deepEqual(result, { ok: true, violations: [] });
});
