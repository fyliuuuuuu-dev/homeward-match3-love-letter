import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const files = ["index.html", "src/styles.css", "src/presentation.css", "src/app.mjs", "src/engine.mjs", "src/onboarding-fixture.mjs", "src/persistence.mjs", "src/presentation.mjs", "src/ui-utils.mjs", "assets/tiles/t001_pebble_dots.svg", "assets/tiles/t002_cushion_grid.svg", "assets/tiles/t003_diamond_ripples.svg", "assets/tiles/t004_hex_honeycomb.svg", "assets/tiles/t005_flower_stitches.svg"];
const afterLoadFiles = ["src/onboarding-coach.mjs", "src/journey-settlement.mjs"];
const bytes = async (name) => Buffer.byteLength((await readFile(path.join(root, name), "utf8")).replaceAll("\r\n", "\n"), "utf8");

test("recursive first-screen V0.2 graph stays local and within budget", async () => {
  const sizes = await Promise.all(files.map(async (name) => [name, await bytes(name)]));
  const limits = { html: 8 * 1024, css: 12 * 1024, mjs: 24 * 1024, svg: 4 * 1024 };
  for (const [name, size] of sizes) assert.ok(size <= limits[path.extname(name).slice(1)], `${name} exceeds V0.2 per-file budget`);
  assert.ok(sizes.reduce((total, [, size]) => total + size, 0) <= 80 * 1024);
  assert.equal(files.length, 14);
});

test("the two after-load modules stay local and within budget", async () => {
  const sizes = await Promise.all(afterLoadFiles.map(async (name) => [name, await bytes(name)]));
  assert.equal(afterLoadFiles.length, 2);
  assert.ok(sizes.reduce((total, [, size]) => total + size, 0) <= 16 * 1024);
  const [app, coach, settlement] = await Promise.all([
    readFile(path.join(root, "src/app.mjs"), "utf8"),
    readFile(path.join(root, afterLoadFiles[0]), "utf8"),
    readFile(path.join(root, afterLoadFiles[1]), "utf8")
  ]);
  assert.match(app, /import\("\.\/onboarding-coach\.mjs"\)/);
  assert.match(app, /import\("\.\/journey-settlement\.mjs"\)/);
  assert.doesNotMatch(coach, /^\s*import\s/m);
  assert.doesNotMatch(settlement, /^\s*import\s/m);
  assert.doesNotMatch(coach.replace("http://www.w3.org/2000/svg", ""), /https?:\/\//);
  assert.doesNotMatch(settlement, /https?:\/\//);
});

test("V0.2 contract records pending runtime evidence", async () => {
  const contract = await readFile(path.join(root, "docs/PERFORMANCE_BUDGET_V0.2.md"), "utf8");
  for (const phrase of ["After-load modules", "route coach", "journey settlement", "p95 frame interval", "long tasks", "rapid swipes", "background recovery", "memory", "real DOM growth", "iPhone Safari"]) assert.match(contract, new RegExp(phrase));
  assert.doesNotMatch(contract, /[\u2013\u2014]|--/);
});
