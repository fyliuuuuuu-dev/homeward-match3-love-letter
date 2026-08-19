import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("active board pointers suppress page movement while outside content remains scrollable", async () => {
  const [app, styles] = await Promise.all([
    read("../src/app.mjs"),
    read("../src/styles.css")
  ]);
  assert.match(styles, /\.board\{[^}]*touch-action:none/);
  assert.match(styles, /\.cell\{[^}]*touch-action:none/);
  assert.match(styles, /\.board-wrap\{[^}]*touch-action:auto/);
  assert.doesNotMatch(styles, /\.board-wrap\{[^}]*touch-action:none/);
  assert.doesNotMatch(styles, /(?:html|body|app-shell)\{[^}]*touch-action:none/);
  const move = app.slice(app.indexOf('ui.board.addEventListener("pointermove"'), app.indexOf("function finishPointer"));
  assert.ok(move.indexOf("event.preventDefault()") < move.indexOf("const cell = cellFromEvent(event)"));
  assert.match(move, /if \(event\.pointerId !== activePointer\)return/);
});

test("status and teaching text reserve stable mobile space", async () => {
  const styles = await read("../src/styles.css");
  assert.match(styles, /\.status-card #status\{min-height:2\.7em;overflow-wrap:anywhere\}/);
  assert.match(styles, /\.mission\{min-height:2\.2em;/);
});

test("stored settlement exposes close and play-again without a rest event", async () => {
  const settlement = await read("../src/journey-settlement.mjs");
  assert.match(settlement, /data-r>Close for now<\/button><button type="button" data-choice="reopen">Play another journey/);
  assert.match(settlement, /data-r[\s\S]*model\.reset\(\);[\s\S]*dialog\.close\(\)/);
  assert.doesNotMatch(settlement, /choice:\s*["']rest["']/);
});

test("mobile hardening stays outside gameplay and storage authorities", async () => {
  const settlement = await read("../src/journey-settlement.mjs");
  assert.doesNotMatch(settlement, /^\s*import\s/m);
  assert.doesNotMatch(settlement, /engine|persistence|random|rng|store\.setItem|validHands|journey\.hands\s*[+<>=]|\b12\b/i);
});
