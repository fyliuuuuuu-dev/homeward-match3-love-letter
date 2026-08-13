import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCoachFrame,
  createCoachModel,
  createCoachReplayModels,
  validateCoachFrames
} from "../src/onboarding-coach.mjs";

const cell = (row, column) => ({ row, column });
const stateFor = (step) => ({
  currentCat: step === 1 ? "B" : "A",
  oldRoute: step === 0 ? [] : [cell(0, 0), cell(0, 1), cell(0, 2)],
  oldRouteCat: step === 0 ? null : step === 1 ? "A" : "B",
  onboarding: {
    enabled: true,
    phase: "tutorial",
    step,
    candidates: step === 0
      ? [[cell(0, 0), cell(0, 1), cell(0, 2)]]
      : step === 1
        ? [[cell(1, 0), cell(1, 1), cell(0, 1)]]
        : [
            [cell(2, 0), cell(2, 1), cell(2, 2), cell(2, 3), cell(2, 4), cell(2, 5)],
            [cell(0, 3), cell(0, 2), cell(0, 1)]
          ]
  }
});

test("coach models consume the authoritative three tutorial states without mutation", () => {
  for (let step = 0; step < 3; step += 1) {
    const state = stateFor(step);
    const before = structuredClone(state);
    const model = createCoachModel(state);
    assert.equal(model.step, step);
    assert.deepEqual(state, before);
    assert.deepEqual(model.routes, state.onboarding.candidates);
  }
});

test("the first step animates a route of at least three matching cells", () => {
  const model = createCoachModel(stateFor(0));
  assert.equal(model.animate, true);
  assert.ok(model.primaryRoute.length >= 3);
  assert.equal(model.showMeetingAtEndpoint, false);
  assert.match(model.text, /three adjacent matching tiles/);
});

test("the second step marks the previous owner and meets only at the endpoint", () => {
  const model = createCoachModel(stateFor(1));
  assert.equal(model.oldRouteCat, "A");
  assert.equal(model.currentCat, "B");
  assert.equal(model.showMeetingAtEndpoint, true);
  assert.deepEqual(model.primaryRoute.at(-1), cell(0, 1));
  assert.match(model.text, /ends on a marked tile/);
});

test("the third step keeps both choices and stops animation", () => {
  const model = createCoachModel(stateFor(2));
  assert.equal(model.routes.length, 2);
  assert.equal(model.animate, false);
  assert.equal(model.showMeetingAtEndpoint, false);
  assert.match(model.text, /Choose your own next move/);
});

test("the coach is absent outside the authoritative tutorial phase", () => {
  const disabled = stateFor(0);
  disabled.onboarding.enabled = false;
  assert.equal(createCoachModel(disabled), null);
  const complete = stateFor(2);
  complete.onboarding.phase = "complete";
  assert.equal(createCoachModel(complete), null);
});

test("completed tutorials produce three strict anonymous replay frames", () => {
  const frames = [0, 1, 2].map((step) => createCoachFrame(stateFor(step)));
  assert.deepEqual(frames.map((frame) => frame.step), [0, 1, 2]);
  const serialized = JSON.stringify(frames);
  for (const forbidden of ["board", "rng", "growth", "events", "session", "time", "private", "objective", "target"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  }
  assert.deepEqual(Object.keys(frames[0]).sort(), ["currentCat", "oldRoute", "oldRouteCat", "routes", "step"]);
});

test("serialized settings restore all three replay semantics in order", () => {
  const stored = JSON.parse(JSON.stringify([0, 1, 2].map((step) => createCoachFrame(stateFor(step)))));
  const models = createCoachReplayModels(stored);
  assert.deepEqual(models.map((model) => model.step), [0, 1, 2]);
  assert.deepEqual(models.map((model) => model.animate), [true, true, false]);
  assert.deepEqual(models.map((model) => model.showMeetingAtEndpoint), [false, true, false]);
  assert.match(models[2].text, /Choose your own next move/);
});

test("skip preference and learned frames coexist in settings", () => {
  const settings = {
    muted: true,
    reducedMotion: false,
    onboardingCoachSkipped: true,
    onboardingCoachFrames: [0, 1, 2].map((step) => createCoachFrame(stateFor(step)))
  };
  const restored = JSON.parse(JSON.stringify(settings));
  assert.equal(restored.onboardingCoachSkipped, true);
  assert.deepEqual(createCoachReplayModels(restored.onboardingCoachFrames).map((model) => model.step), [0, 1, 2]);
});

test("damaged, duplicate, oversized, and out-of-bounds frames fail closed", () => {
  const valid = [0, 1, 2].map((step) => createCoachFrame(stateFor(step)));
  const cases = [
    { broken: true },
    [{ ...valid[0], unknown: true }],
    [...valid, { ...valid[2], step: 2 }],
    [valid[0], { ...valid[1], step: 0 }],
    [{ ...valid[0], routes: [[cell(0, 0), cell(0, 1), cell(7, 2)]] }],
    [{ ...valid[0], routes: [Array.from({ length: 43 }, () => cell(0, 0))] }],
    [{ ...valid[0], routes: [valid[0].routes[0], valid[0].routes[0], valid[0].routes[0]] }]
  ];
  for (const value of cases) assert.deepEqual(validateCoachFrames(value), []);
  assert.deepEqual(validateCoachFrames(valid).map((frame) => frame.step), [0, 1, 2]);
});

test("integration keeps the coach decorative, English, and input independent", async () => {
  const [html, app, coach, css, presentation] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/onboarding-coach.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation.css", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation.mjs", import.meta.url), "utf8")
  ]);
  assert.match(app, /import\("\.\/onboarding-coach\.mjs"\)/);
  assert.match(app, /settings\.onboardingCoachSkipped = true/);
  assert.match(app, /settings\.onboardingCoachFrames = frames/);
  assert.match(app, /window\.addEventListener\("load"[\s\S]*coachAutoLoadEnabled = true[\s\S]*syncCoach\(\)/);
  assert.match(app, /function syncCoach\(\) \{\s*if \(!coachAutoLoadEnabled\) return/);
  assert.match(html, /id="replayCoach"[^>]*>Replay three-step demo/);
  assert.equal((html.match(/aria-live=|role="status"/g) || []).length, 1);
  assert.doesNotMatch(`${html}\n${app}\n${coach}\n${css}\n${presentation}`, /[\u3400-\u9fff\uf900-\ufaff]/u);
  assert.doesNotMatch(coach, /private|personal|source|engine|persistence|areAdjacent|hasLegalRoute|advancePath|meetingGrowth|baseGrowth/i);
  assert.doesNotMatch(coach, /^\s*import\s/m);
  assert.doesNotMatch(coach, /setTimeout|setInterval/);
  assert.match(coach, /"aria-hidden": "true"/);
  assert.match(coach, /ownGeneration !== generation/);
  assert.match(css, /\.onboarding-coach-visual[\s\S]*pointer-events:\s*none/);
  assert.match(coach, /Skip three-step route demo/);
  assert.match(coach, /Close the route demo and start playing/);
  assert.match(presentation, /coordinateCells/);
});

test("reduced motion keeps route endpoints and avoids animation calls", async () => {
  const coach = await readFile(new URL("../src/onboarding-coach.mjs", import.meta.url), "utf8");
  assert.match(coach, /if \(reducedMotion\)/);
  assert.match(coach, /marker\.setAttribute\("cx", String\(endpoint\.x\)\)/);
  assert.ok(coach.indexOf("if (reducedMotion)") < coach.indexOf("marker.animate("));
});

test("coach source stays free of doubled hyphens and trailing whitespace", async () => {
  const [coach, docs] = await Promise.all([
    readFile(new URL("../src/onboarding-coach.mjs", import.meta.url), "utf8"),
    readFile(new URL("../docs/ONBOARDING_COACH_V0.1.md", import.meta.url), "utf8")
  ]);
  const forbiddenDash = new RegExp(`[\\u2013\\u2014]|${String.fromCharCode(45, 45)}`);
  for (const source of [coach, docs]) {
    assert.doesNotMatch(source, forbiddenDash);
    assert.doesNotMatch(source, /[ \t]+$/m);
  }
});
