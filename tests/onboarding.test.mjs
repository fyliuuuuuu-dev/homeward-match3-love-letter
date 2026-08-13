import assert from "node:assert/strict";
import test from "node:test";
import { GreyboxEngine, ROWS, COLUMNS, indexOf } from "../src/engine.mjs";
import { createOnboardingFixture } from "../src/onboarding-fixture.mjs";
import { migrateV1ToV2, readSaveWithMigration, validateSave } from "../src/persistence.mjs";

const cell = (row, column) => ({ row, column });
const route = [cell(0, 0), cell(0, 1), cell(0, 2)];
const submit = (engine, path) => {
  assert.equal(engine.beginTrace(path[0]), true);
  for (const point of path.slice(1)) assert.equal(engine.extendTrace(point), "append");
  return engine.submitTrace();
};
const legacyState = (state) => {
  const { oldRouteCat, onboarding, journey, feedbackTier, objective, ...legacy } = state;
  return JSON.parse(JSON.stringify(legacy));
};

test("three-step onboarding is deterministic and protects wrong routes", () => {
  const first = createOnboardingFixture();
  assert.deepEqual(first, createOnboardingFixture());
  const engine = new GreyboxEngine({ seed: 22, onboardingEnabled: true });
  const before = JSON.stringify({ state: engine.state, rng: engine.rng.snapshot() });
  const wrong = submit(engine, [cell(3, 0), cell(3, 1), cell(3, 2)]);
  assert.equal(wrong.reason, "onboarding_target_mismatch");
  assert.equal(JSON.stringify({ state: engine.state, rng: engine.rng.snapshot() }), before);
  assert.equal(submit(engine, first.steps[0].candidates[0]).valid, true);
  assert.equal(engine.state.onboarding.step, 1);
});

test("feedback tiers include long routes, rendezvous, and twelve-move arrival", () => {
  const engine = new GreyboxEngine({ seed: 3, board: Array.from({ length: ROWS * COLUMNS }, (_, index) => index % 5) });
  const long = [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2), cell(1, 1), cell(1, 0)];
  for (const point of long) engine.state.board[indexOf(point)] = 0;
  assert.equal(submit(engine, long).feedbackTier, "long");
  engine.state.journey.hands = 11;
  engine.state.oldRoute = [];
  for (const point of route) engine.state.board[indexOf(point)] = 1;
  assert.equal(submit(engine, route).feedbackTier, "arrival");
  assert.deepEqual(engine.state.journey, { hands: 0, completed: 1 });
});

test("v1 saves migrate into v2 without changing the source", () => {
  const engine = new GreyboxEngine({ seed: 22 });
  const exported = engine.exportData();
  const legacy = JSON.parse(JSON.stringify(exported));
  delete legacy.saveSchemaVersion;
  legacy.buildVersion = "homeward-prototype-0.1.0";
  legacy.eventVersion = 1;
  legacy.stableSnapshot = legacyState(legacy.stableSnapshot);
  legacy.state = legacyState(legacy.state);
  legacy.events = legacy.events.map((event) => ({ ...event, buildVersion: "homeward-prototype-0.1.0", eventVersion: 1, before: legacyState(event.before), after: legacyState(event.after) }));
  const source = JSON.stringify(legacy);
  const migrated = migrateV1ToV2(legacy);
  assert.equal(migrated.ok, true);
  assert.equal(validateSave(migrated.value).ok, true);
  assert.equal(JSON.stringify(legacy), source);
  const values = new Map([["v1", source]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(readSaveWithMigration(storage, { v2Key: "v2", v1Key: "v1", expected: { seed: 22, mode: "relax" } }).migrated, true);
});
