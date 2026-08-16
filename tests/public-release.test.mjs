import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanTree } from "../scripts/scan-public.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const load = (path) => readFile(new URL(path, new URL("../", import.meta.url)), "utf8");

test("required public documentation is present", async () => {
  const required = ["README.md", "COMPANIONS.md", "CONTRIBUTING.md", "SECURITY.md", "PRIVACY.md", "CUSTOMIZATION.md", "LICENSE", "ASSET_LICENSE.md", "PUBLIC_ASSET_MANIFEST.md", "PUBLIC_RELEASE_SCAN.md", "docs/ONBOARDING_COACH_V0.1.md", "docs/JOURNEY_SETTLEMENT_V0.1.md", "docs/RELEASE_NOTES_V0.2.0.md", ".github/workflows/ci.yml"];
  await Promise.all(required.map((name) => access(resolve(root, name))));
});

test("CI uses supported Node versions, minimal permissions, and repository checks", async () => {
  const workflow = await load(".github/workflows/ci.yml");
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /node-version: \[20, 22\]/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run scan -- --check/);
  assert.doesNotMatch(workflow, /secrets\.|permissions:\s*write|contents: write/i);
  const actions = [...workflow.matchAll(/^\s*uses:\s*([^\s]+)$/gm)].map((match) => match[1]);
  assert.deepEqual(actions, ["actions/checkout@v4", "actions/setup-node@v4"]);
});

test("v0.2.0 release copy keeps ownership and validation boundaries explicit", async () => {
  const [readme, notes] = await Promise.all([load("README.md"), load("docs/RELEASE_NOTES_V0.2.0.md")]);
  for (const heading of ["Why This Matters", "How Codex Is Used", "Public preview"]) assert.match(readme, new RegExp(`## ${heading}`));
  for (const responsibility of ["product direction", "game rules", "acceptance decisions", "permissions", "privacy", "publication"]) {
    assert.match(readme, new RegExp(responsibility));
  }
  assert.match(readme, /not published until it has been reviewed/);
  assert.match(notes, /^# Homeward v0\.2\.0: First Public Playable Prototype/m);
  for (const heading of ["Playable scope", "Run and verify", "Known limitations", "Privacy boundary", "Companion portrait license", "Next phase"]) {
    assert.match(notes, new RegExp(`## ${heading}`));
  }
  assert.doesNotMatch(`${readme}\n${notes}`, /wife playtest|wife tested|externally validated|external validation complete/i);
});

test("v0.2.0 release media is present, bounded, and referenced", async () => {
  const screenshot = "docs/media/homeward-v0.2.0-first-screen.png";
  const demo = "docs/media/homeward-v0.2.0-rendezvous-demo.gif";
  const [readme, png, gif, pngStat, gifStat] = await Promise.all([
    load("README.md"),
    readFile(resolve(root, screenshot)),
    readFile(resolve(root, demo)),
    stat(resolve(root, screenshot)),
    stat(resolve(root, demo))
  ]);
  assert.match(readme, new RegExp(screenshot.replaceAll(".", "\\.")));
  assert.match(readme, new RegExp(demo.replaceAll(".", "\\.")));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(gif.subarray(0, 6).toString("ascii"), /^GIF8[79]a$/);
  assert.ok(pngStat.size > 10_000 && pngStat.size < 2_000_000);
  assert.ok(gifStat.size > 10_000 && gifStat.size < 8_000_000);
});

test("the public interface is English and exposes one live status region", async () => {
  const [html, app, presentation] = await Promise.all([load("index.html"), load("src/app.mjs"), load("src/presentation.mjs")]);
  assert.match(html, /<html lang="en">/);
  assert.equal((html.match(/role="status"|aria-live=/g) || []).length, 1);
  assert.doesNotMatch(`${html}\n${app}\n${presentation}`, /[\u3400-\u9fff\uf900-\ufaff]/u);
  assert.match(html, /id="submitPath"[^>]*disabled/);
  assert.match(html, /id="cancelPath"[^>]*disabled/);
});

test("entry resources use one fixed local version query", async () => {
  const [html, app] = await Promise.all([load("index.html"), load("src/app.mjs")]);
  assert.match(html, /href="src\/styles\.css\?v=4"/);
  assert.match(html, /href="src\/presentation\.css\?v=4"/);
  assert.match(html, /src="src\/app\.mjs\?v=4"/);
  assert.match(app, /import\("\.\/onboarding-coach\.mjs\?v=4"\)/);
  assert.match(app, /import\("\.\/journey-settlement\.mjs\?v=4"\)/);
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

test("page and code omit capture blocking and recording capabilities", async () => {
  const files = ["index.html", "src/app.mjs", "src/onboarding-coach.mjs", "src/presentation.mjs", "src/presentation.css"];
  const sources = await Promise.all(files.map(load));
  const forbidden = /PrintScreen|getDisplayMedia|screen.?capture|screenshot|toDataURL|html2canvas|clipboard.*image|captureStream/i;
  for (const [index, source] of sources.entries()) assert.doesNotMatch(source, forbidden, files[index]);
});
