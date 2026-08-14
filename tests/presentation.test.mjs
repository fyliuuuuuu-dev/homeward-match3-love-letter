import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPresentationModel, meetingFeedbackMessage, TILE_ASSET_FILES } from "../src/presentation.mjs";
import { svgPathGeometry } from "../src/ui-utils.mjs";

const cell = (row, column) => ({ row, column });
const state = () => ({
  board: Array.from({ length: 42 }, (_, index) => index % 5),
  oldRoute: [cell(0, 0), cell(0, 1)],
  currentCat: "A",
  growth: 7,
  validHands: 2,
  status: "READY",
  mission: { enabled: false, active: false, hands: 0, meetings: 0, result: null, rewardGranted: false }
});

test("the presenter exposes exactly five generic tile assets", () => {
  assert.deepEqual(TILE_ASSET_FILES, [
    "t001_pebble_dots.svg",
    "t002_cushion_grid.svg",
    "t003_diamond_ripples.svg",
    "t004_hex_honeycomb.svg",
    "t005_flower_stitches.svg"
  ]);
});

test("meeting feedback is deterministic, generic, and sourced from authoritative growth fields", async () => {
  const result = { valid: true, meeting: true, baseGrowth: 3, meetingGrowth: 4 };
  const before = structuredClone(result);
  const first = meetingFeedbackMessage(result);
  const second = meetingFeedbackMessage(structuredClone(result));
  assert.equal(first, second);
  assert.match(first, /companions meet/);
  assert.match(first, /7 journey points/);
  assert.match(first, /fixed \+4 rendezvous bonus/);
  assert.deepEqual(result, before);
  const source = await readFile(new URL("../src/presentation.mjs", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export function meetingFeedbackMessage"), source.indexOf("export function createPresentationModel"));
  assert.match(body, /result\?\.baseGrowth/);
  assert.match(body, /result\?\.meetingGrowth/);
  assert.doesNotMatch(body, /Math\.random|crypto|rng|random/i);
});

test("presentation state copies previous and current routes", () => {
  const currentPath = [cell(1, 1), cell(1, 2), cell(2, 3)];
  const model = createPresentationModel({ state: state(), path: currentPath, action: "backtrack" });
  assert.deepEqual(model.oldRoute, [cell(0, 0), cell(0, 1)]);
  assert.deepEqual(model.path, currentPath);
  assert.equal(model.traceFeedback, "backtrack");
  assert.deepEqual(model.resolveCells, []);
});

test("resolve effects consume only a valid authoritative engine result", () => {
  const result = {
    valid: true,
    path: [cell(2, 1), cell(2, 2), cell(3, 3)],
    replacements: [{ ...cell(2, 1), node: 4 }],
    meeting: true,
    reshuffled: false
  };
  const valid = createPresentationModel({ state: state(), result });
  assert.deepEqual(valid.resolveCells, result.path);
  assert.deepEqual(valid.meetingEndpoint, cell(3, 3));
  const invalid = createPresentationModel({ state: state(), result: { ...result, valid: false } });
  assert.deepEqual(invalid.resolveCells, []);
  assert.equal(invalid.meetingEndpoint, null);
});

test("presentation inputs cannot be changed through later engine mutation", () => {
  const currentState = state();
  const model = createPresentationModel({ state: currentState, path: [cell(1, 1)] });
  currentState.oldRoute.length = 0;
  assert.deepEqual(model.oldRoute, [cell(0, 0), cell(0, 1)]);
});

test("SVG path geometry uses the board coordinate system", () => {
  const geometry = svgPathGeometry(304, 354.5, [cell(0, 0), cell(6, 5)]);
  assert.equal(geometry.viewBox, "0 0 304 354.5");
  assert.equal(geometry.points.split(" ").length, 2);
});
