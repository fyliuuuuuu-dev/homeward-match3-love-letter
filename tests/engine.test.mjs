import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILD_VERSION,
  COLUMNS,
  EVENT_VERSION,
  GreyboxEngine,
  ROWS,
  advancePath,
  areAdjacent,
  hasLegalRoute,
  indexOf
} from "../src/engine.mjs";
import { parseSave, safeStorageRead, safeStorageWrite, validateSave } from "../src/persistence.mjs";

const cell = (row, column) => ({ row, column });
const route = [cell(0, 0), cell(0, 1), cell(0, 2)];

function baseBoard() {
  return Array.from({ length: ROWS * COLUMNS }, (_, index) => index % 5);
}

function deadBoard() {
  return Array.from({ length: ROWS * COLUMNS }, (_, index) => {
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    return (row * 2 + column) % 5;
  });
}

function setRouteType(engine, cells, type = 0) {
  for (const point of cells) engine.state.board[indexOf(point)] = type;
}

function play(engine, cells = route) {
  assert.equal(engine.beginTrace(cells[0]), true);
  for (const point of cells.slice(1)) assert.equal(engine.extendTrace(point), "append");
  return engine.submitTrace();
}

test("fixed seeds reproduce the board and replacement sequence", () => {
  const first = new GreyboxEngine({ seed: 12345 });
  const second = new GreyboxEngine({ seed: 12345 });
  assert.deepEqual(first.state.board, second.state.board);
  setRouteType(first, route, 2);
  setRouteType(second, route, 2);
  assert.deepEqual(play(first).replacements, play(second).replacements);
  assert.deepEqual(first.state.board, second.state.board);
});

test("all eight neighboring directions are legal", () => {
  const center = cell(3, 3);
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
      if (rowDelta || columnDelta) assert.equal(areAdjacent(center, cell(3 + rowDelta, 3 + columnDelta)), true);
    }
  }
  assert.equal(areAdjacent(center, cell(3, 5)), false);
});

test("paths accept same-type neighbors and reject other types or distant cells", () => {
  const board = baseBoard();
  board[indexOf(cell(0, 0))] = 3;
  board[indexOf(cell(0, 1))] = 3;
  board[indexOf(cell(0, 3))] = 3;
  assert.equal(advancePath(board, [cell(0, 0)], cell(0, 1)).action, "append");
  assert.equal(advancePath(board, [cell(0, 0)], cell(0, 2)).action, "ignored");
  assert.equal(advancePath(board, [cell(0, 0)], cell(0, 3)).action, "ignored");
});

test("returning to the previous or an earlier tile shortens a path", () => {
  const board = Array.from({ length: ROWS * COLUMNS }, () => 4);
  const path = [cell(0, 0), cell(0, 1), cell(1, 1), cell(1, 0)];
  assert.deepEqual(advancePath(board, path, cell(1, 1)), { path: path.slice(0, 3), action: "backtrack" });
  assert.deepEqual(advancePath(board, path, cell(0, 0)), { path: [cell(0, 0)], action: "truncate" });
});

test("a valid path requires at least three tiles", () => {
  const engine = new GreyboxEngine({ seed: 7, board: baseBoard() });
  setRouteType(engine, route, 1);
  const result = play(engine);
  assert.equal(result.valid, true);
  assert.equal(result.baseGrowth, 3);
  assert.equal(engine.state.validHands, 1);
});

test("an invalid release is atomic", () => {
  const engine = new GreyboxEngine({ seed: 8, board: baseBoard() });
  const before = engine.exportData();
  engine.beginTrace(cell(0, 0));
  const result = engine.submitTrace();
  assert.equal(result.valid, false);
  assert.deepEqual(engine.state.board, before.state.board);
  assert.equal(engine.state.growth, before.state.growth);
  assert.equal(engine.state.currentCat, before.state.currentCat);
  assert.equal(engine.rng.snapshot().draws, before.rng.draws);
});

test("only an endpoint on the previous route earns a rendezvous bonus", () => {
  const endpoint = new GreyboxEngine({ seed: 9, board: baseBoard() });
  setRouteType(endpoint, route);
  endpoint.state.oldRoute = [cell(0, 2)];
  assert.equal(play(endpoint).meeting, true);
  assert.equal(endpoint.state.growth, 7);

  const crossing = new GreyboxEngine({ seed: 10, board: baseBoard() });
  setRouteType(crossing, route);
  crossing.state.oldRoute = [cell(0, 1)];
  assert.equal(play(crossing).meeting, false);
});

test("cleared tiles refill in place without gravity", () => {
  const engine = new GreyboxEngine({ seed: 11, board: baseBoard() });
  setRouteType(engine, route, 2);
  const untouched = engine.state.board[indexOf(cell(1, 0))];
  const result = play(engine);
  assert.deepEqual(result.replacements.map(({ row, column }) => ({ row, column })), route);
  assert.equal(engine.state.board[indexOf(cell(1, 0))], untouched);
});

test("dead boards are deterministically replaced with playable boards", () => {
  const board = deadBoard();
  assert.equal(hasLegalRoute(board), false);
  const first = new GreyboxEngine({ seed: 12, board });
  const second = new GreyboxEngine({ seed: 12, board });
  assert.equal(hasLegalRoute(first.state.board), true);
  assert.deepEqual(first.state.board, second.state.board);
  assert.deepEqual(first.state.oldRoute, []);
});

test("the optional challenge completes after eight moves with three rendezvous", () => {
  const engine = new GreyboxEngine({ seed: 13, board: baseBoard(), missionEnabled: true });
  engine.state.oldRoute = [cell(0, 2)];
  for (let move = 0; move < 8; move += 1) {
    setRouteType(engine, route, move % 5);
    const result = play(engine);
    assert.equal(result.valid, true);
  }
  assert.equal(engine.state.mission.active, false);
  assert.equal(engine.state.mission.result, "complete");
  assert.equal(engine.state.mission.rewardGranted, true);
});

test("suspend cancels an unfinished path and resume returns to ready", () => {
  const engine = new GreyboxEngine({ seed: 14 });
  engine.beginTrace(cell(0, 0));
  engine.suspend();
  assert.equal(engine.state.status, "SUSPENDED");
  assert.deepEqual(engine.path, []);
  engine.resume();
  assert.equal(engine.state.status, "READY");
});

test("valid saves restore stable state, random state, and the local session", () => {
  const engine = new GreyboxEngine({ seed: 15 });
  setRouteType(engine, route, 3);
  play(engine);
  const saved = { ...engine.exportData(), savedAt: "2026-01-01T00:00:00.000Z" };
  const checked = validateSave(saved, { seed: 15, mode: "relax" });
  assert.equal(checked.ok, true);
  const restored = GreyboxEngine.fromSave(checked.value);
  assert.equal(restored.state.status, "READY");
  assert.deepEqual(restored.state.board, engine.state.board);
  assert.deepEqual(restored.rng.snapshot(), engine.rng.snapshot());
  assert.equal(restored.state.sessionId, engine.state.sessionId);
});

test("damaged or incompatible saves fail closed", () => {
  assert.deepEqual(parseSave("{broken"), { ok: false, reason: "invalid_json" });
  const exported = new GreyboxEngine({ seed: 16 }).exportData();
  exported.buildVersion = "incompatible";
  assert.equal(validateSave(exported).reason, "build_version_mismatch");
});

test("event validation rejects personal-data fields", () => {
  const exported = new GreyboxEngine({ seed: 17 }).exportData();
  exported.events[0].payload.email = "example.invalid";
  assert.equal(validateSave(exported).reason, "private_event_field");
});

test("storage failures remain recoverable", () => {
  const unavailable = {
    getItem() { throw new DOMException("blocked", "SecurityError"); },
    setItem() { throw new DOMException("full", "QuotaExceededError"); }
  };
  assert.equal(safeStorageRead(unavailable, "x").reason, "storage_read_failed");
  assert.equal(safeStorageWrite(unavailable, "x", "y").reason, "storage_write_failed");
});

test("the export contract uses public build and event versions", () => {
  const exported = new GreyboxEngine({ seed: 18 }).exportData();
  assert.equal(exported.buildVersion, BUILD_VERSION);
  assert.equal(exported.eventVersion, EVENT_VERSION);
  assert.match(exported.buildVersion, /^homeward-prototype-/);
});
