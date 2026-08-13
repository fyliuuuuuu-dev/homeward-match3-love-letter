import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createJourneySettlementModel, storedSettlementCopy } from "../src/journey-settlement.mjs";

const snapshot = (completed = 1, growth = 36, hands = 0) => ({
  board: [1, 2, 3],
  currentCat: "B",
  oldRoute: [{ row: 0, column: 1 }],
  growth,
  journey: { hands, completed },
  random: { state: 44, draws: 9 }
});

test("settlement trusts only an authoritative arrival result", () => {
  const model = createJourneySettlementModel();
  assert.equal(model.show({ result: { arrival: false }, state: snapshot(99, 800, 0) }), false);
  assert.equal(model.snapshot(), null);
  assert.equal(model.show({ result: { arrival: true }, state: snapshot(1, 36, 7) }), true);
  assert.deepEqual(model.snapshot(), { journeyCompleted: 1, growth: 36, phase: "choice" });
});

test("continue and store preserve authoritative game state", () => {
  for (const choice of ["continue", "store"]) {
    const model = createJourneySettlementModel();
    const state = snapshot();
    const before = structuredClone(state);
    assert.equal(model.show({ result: { arrival: true }, state }), true);
    assert.deepEqual(model.choose(choice), { choice, journeyCompleted: 1, growth: 36 });
    assert.equal(model.choose(choice), null);
    assert.deepEqual(state, before);
  }
});

test("store and reopen create two explicit anonymous choices", () => {
  const model = createJourneySettlementModel();
  model.show({ result: { arrival: true }, state: snapshot(3, 108) });
  assert.equal(model.choose("reopen"), null);
  assert.deepEqual(model.choose("store"), { choice: "store", journeyCompleted: 3, growth: 108 });
  assert.equal(model.snapshot().phase, "stored");
  const reopened = model.choose("reopen");
  assert.deepEqual(reopened, { choice: "reopen", journeyCompleted: 3, growth: 108 });
  assert.deepEqual(Object.keys(reopened).sort(), ["choice", "growth", "journeyCompleted"]);
  assert.equal(model.snapshot(), null);
});

test("reset and repeated show cannot replay an old settlement", () => {
  const model = createJourneySettlementModel();
  const input = { result: { arrival: true }, state: snapshot() };
  assert.equal(model.show(input), true);
  assert.equal(model.show(input), false);
  model.reset();
  assert.equal(model.snapshot(), null);
  assert.equal(model.choose("continue"), null);
});

test("stored copy distinguishes save success from failure", () => {
  const active = { journeyCompleted: 2, growth: 72 };
  const success = storedSettlementCopy(active, true);
  assert.match(success.title, /saved locally/);
  assert.match(success.copy, /close this page/);
  const failure = storedSettlementCopy(active, false);
  assert.doesNotMatch(`${failure.kicker}${failure.title}${failure.copy}`, /saved locally/);
  assert.match(failure.title, /save did not complete/);
  assert.match(failure.copy, /remain in this open game/);
  assert.match(failure.copy, /Download the session log/);
});

test("module is presentation only and app blocks input while settlement is pending", async () => {
  const [module, app] = await Promise.all([
    readFile(new URL("../src/journey-settlement.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/app.mjs", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(module, /^\s*import\s/m);
  assert.doesNotMatch(module, /private|personal|engine|persistence|validHands|journey\.hands\s*[+<>=]|\b12\b/i);
  assert.match(module, /result\?\.arrival !== true/);
  assert.match(module, /addEventListener\("cancel", \(event\) => event\.preventDefault\(\)\)/);
  assert.match(module, /showModal\(\)/);
  assert.match(module, /data-choice="continue"[\s\S]*\.focus\(\)/);
  for (const text of ["Journey ", "journey points", "Start another journey", "Save for today", "saved locally", "Play another journey"]) {
    assert.match(module, new RegExp(text));
  }
  assert.match(app, /pendingArrival = \{[\s\S]*result: \{ arrival: true \}/);
  assert.match(app, /ensureSettlement\(\)\.then\(\(ready\) => \{[\s\S]*ready\.show\(pendingArrival\);[\s\S]*pendingArrival = null/);
  assert.match(app, /settlementBlocked\(\) \|\| activePointer/);
  assert.match(app, /settlementBlocked\(\) \|\| engine\.state\.status !== "TRACING"/);
  assert.match(app, /engine\.log\("journey_settlement_choice", null, payload\);[\s\S]*return save\(\)/);
  assert.match(app, /return saveResult\.ok/);
});

test("deferred import failure releases input and permits retry", async () => {
  const app = await readFile(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(app, /\.catch\(\(\) => \{[\s\S]*settlementLoadFailed\(\);[\s\S]*return null/);
  const failure = app.slice(app.indexOf("function settlementLoadFailed"), app.indexOf("function ensureSettlement"));
  assert.match(failure, /pendingArrival = null/);
  assert.match(failure, /settlementPromise = null/);
  assert.match(failure, /arrivalWasPending = !!pendingArrival/);
  assert.match(failure, /if \(arrivalWasPending\) render/);
  assert.match(failure, /summary could not load/);
  assert.doesNotMatch(failure, /engine\.|growth\s*=|journey\s*=/);
});
