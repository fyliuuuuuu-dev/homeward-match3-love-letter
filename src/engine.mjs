export const ROWS = 7;
export const COLUMNS = 6;
export const NODE_TYPES = 5;
export const BUILD_VERSION = "homeward-prototype-0.2.0";
export const EVENT_VERSION = 2;
export const SAVE_SCHEMA_VERSION = 2;
import { createOnboardingFixture, sameRoute } from "./onboarding-fixture.mjs";
const clone = (value) => JSON.parse(JSON.stringify(value));
const keyOf = ({
  row, column
}) => `${row},${column}`;
export function createRng(seed = 1, state = null, draws = 0) {
  let value = state === null?(Number(seed) >>> 0) || 1: state >>> 0;
  let drawCount = draws;
  return {
    next() {
      value^= value << 13;
      value^= value >>> 17;
      value^= value << 5;
      drawCount += 1;
      return(value >>> 0)/4294967296;
    }, int(max) {
      return Math.floor(this.next()*max);
    }, snapshot() {
      return {
        state: value >>> 0, draws: drawCount
      };
    }
  };
}
export function areAdjacent(a, b) {
  const dr = Math.abs(a.row-b.row);
  const dc = Math.abs(a.column-b.column);
  return dr <= 1 && dc <= 1 && dr+dc>0;
}
export function isInBounds(cell) {
  return cell && Number.isInteger(cell.row) && Number.isInteger(cell.column) && cell.row >= 0 && cell.row<ROWS && cell.column >= 0 && cell.column<COLUMNS;
}
export function indexOf(cell) {
  return cell.row*COLUMNS+cell.column;
}
export function hasLegalRoute(board) {
  const visited = new Set();
  for (let row = 0; row<ROWS; row += 1) {
    for (let column = 0; column<COLUMNS; column += 1) {
      const start = {
        row, column
      };
      const startKey = keyOf(start);
      if (visited.has(startKey))continue;
      const type = board[indexOf(start)];
      const queue = [start];
      visited.add(startKey);
      let size = 0;
      while (queue.length) {
        const cell = queue.pop();
        size += 1;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const next = {
              row: cell.row+dr, column: cell.column+dc
            };
            const nextKey = keyOf(next);
            if ((dr === 0 && dc === 0) || !isInBounds(next) || visited.has(nextKey))continue;
            if (board[indexOf(next)] === type) {
              visited.add(nextKey);
              queue.push(next);
            }
          }
        }
      }
      if (size >= 3)return true;
    }
  }
  return false;
}
export function advancePath(board, path, cell) {
  if (!isInBounds(cell))return {
    path, action: "ignored"
  };
  if (path.length === 0)return {
    path: [clone(cell)], action: "start"
  };
  const existing = path.findIndex((item) => keyOf(item) === keyOf(cell));
  if (existing >= 0 && existing === path.length-2)return {
    path: path.slice(0, -1), action: "backtrack"
  };
  if (existing >= 0 && existing<path.length-2)return {
    path: path.slice(0, existing+1), action: "truncate"
  };
  if (existing >= 0)return {
    path, action: "ignored"
  };
  const previous = path[path.length-1];
  if (!areAdjacent(previous, cell))return {
    path, action: "ignored"
  };
  if (board[indexOf(previous)] !== board[indexOf(cell)])return {
    path, action: "ignored"
  };
  return {
    path: [...path, clone(cell)], action: "append"
  };
}
export function summarizeState(state) {
  return {
    status: state.status,
    board: [...state.board],
    oldRoute: clone(state.oldRoute),
    oldRouteCat: state.oldRouteCat,
    currentCat: state.currentCat,
    growth: state.growth,
    validHands: state.validHands,
    mission: clone(state.mission),
    onboarding: clone(state.onboarding),
    journey: clone(state.journey),
    feedbackTier: state.feedbackTier,
    objective: clone(state.objective)
  };
}
function makeSessionId(seed) {
  return`local-${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
export class GreyboxEngine{
  constructor({
    seed = 32032, missionEnabled = false, onboardingEnabled = false, board = null, sessionId = null, reshuffleLimit = 256, testFailAt = null
  }
  = {
  }) {
    this.seed = Number(seed) >>> 0;
    this.mode = missionEnabled?"mission": "relax";
    this.rng = createRng(this.seed);
    this.fixture = onboardingEnabled && !missionEnabled?createOnboardingFixture(): null;
    this.startedAt = Date.now();
    this.eventSequence = 0;
    this.events = [];
    this.reshuffleLimit = reshuffleLimit;
    this.testFailAt = testFailAt;
    this.state = {
      status: "LOADING",
      board: board?[...board]: (this.fixture?[...this.fixture.initialBoard]: []),
      oldRoute: [],
      oldRouteCat: null,
      currentCat: "A",
      growth: 0,
      validHands: 0,
      mission: {
        enabled: missionEnabled, active: missionEnabled, hands: 0, meetings: 0, result: null, rewardGranted: false
      }, onboarding: {
        enabled: !!this.fixture,
        phase: this.fixture?"tutorial": "complete",
        step: 0,
        calibrationHands: 0,
        calibrationMeetings: 0,
        result: null,
        fixtureId: this.fixture?.id || null,
        randomCursor: 0,
        target: null,
        candidates: []
      }, journey: {
        hands: 0, completed: 0
      }, feedbackTier: null, objective: {
        kind: missionEnabled?"mission": this.fixture?"tutorial": "journey", text: "", remaining: missionEnabled?8: this.fixture?1: 12
      }, sessionId: sessionId || makeSessionId(this.seed), lastSavedAt: null, stableSnapshot: null
    };
    if (this.state.board.length !== ROWS*COLUMNS)this.state.board = this.drawBoard();
    this.log("session_start", null, {
      seed: this.seed
    });
    this.ensurePlayable("initial");
    this.state.status = "READY";
    this.refreshObjective();
    this.state.stableSnapshot = summarizeState(this.state);
    this.log("board_ready", null, {
      board: [...this.state.board]
    });
  }
  static fromSave(save) {
    const engine = Object.create(GreyboxEngine.prototype);
    engine.seed = save.seed >>> 0;
    engine.mode = save.mode;
    engine.rng = createRng(engine.seed, save.rng.state, save.rng.draws);
    engine.fixture = save.stableSnapshot.onboarding?.fixtureId?createOnboardingFixture(): null;
    const lastRelativeMs = save.events.length?save.events[save.events.length-1].relativeMs: 0;
    engine.startedAt = Date.now()-lastRelativeMs;
    engine.eventSequence = Number(save.eventSequence) || 0;
    engine.events = clone(save.events);
    engine.reshuffleLimit = 256;
    engine.testFailAt = null;
    engine.path = [];
    engine.state = {
      ...clone(save.stableSnapshot), status: "READY", sessionId: save.sessionId, lastSavedAt: save.savedAt || null, stableSnapshot: clone(save.stableSnapshot)
    };
    engine._lastEventState = clone(engine.events.length?engine.events[engine.events.length-1].after: summarizeState(engine.state));
    engine._lastRelativeMs = lastRelativeMs;
    engine.log("session_restored", null, {
      previousSavedAt: save.savedAt || null
    });
    return engine;
  }
  drawNode() {
    return this.rng.int(NODE_TYPES);
  }
  refreshObjective() {
    const onboarding = this.state.onboarding;
    if (onboarding.enabled && onboarding.phase === "tutorial") {
      const step = this.fixture.steps[onboarding.step];
      onboarding.target = step?.target || null;
      onboarding.candidates = clone(step?.candidates || []);
      this.state.objective = {
        kind: "tutorial", text: onboarding.target || "Complete the guided route", remaining: 1
      };
    } else if (onboarding.enabled && onboarding.phase === "calibration") {
      onboarding.target = "Make two rendezvous within eight valid moves";
      onboarding.candidates = [];
      this.state.objective = {
        kind: "calibration", text: onboarding.target, remaining: Math.max(0, 8-onboarding.calibrationHands)
      };
    } else if (this.state.mission.enabled) {
      this.state.objective = {
        kind: "mission", text: "Make three rendezvous within eight valid moves", remaining: Math.max(0, 8-this.state.mission.hands)
      };
    } else {
      this.state.objective = {
        kind: "journey", text: "Complete this journey", remaining: 12-this.state.journey.hands
      };
    }
  }
  drawRefillNode() {
    const onboarding = this.state.onboarding;
    if (this.fixture && onboarding?.phase !== "complete" && onboarding.randomCursor<this.fixture.refillSequence.length) {
      const node = this.fixture.refillSequence[onboarding.randomCursor];
      onboarding.randomCursor += 1;
      return node;
    }
    return this.drawNode();
  }
  drawBoard() {
    return Array.from({
      length: ROWS*COLUMNS
    }, () => this.drawNode());
  }
  log(type, before, payload = {
  }) {
    const rng = this.rng.snapshot();
    const afterState = summarizeState(this.state);
    const beforeState = clone(this._lastEventState || before || afterState);
    const relativeMs = Math.max(Date.now()-this.startedAt, this._lastRelativeMs || 0);
    const event = {
      eventVersion: EVENT_VERSION,
      buildVersion: BUILD_VERSION,
      sessionId: this.state.sessionId,
      sequence: ++this.eventSequence,
      relativeMs,
      mode: this.mode,
      seed: this.seed,
      randomDraw: rng.draws,
      before: beforeState,
      after: afterState,
      type,
      payload: clone(payload)
    };
    this.events.push(event);
    this._lastEventState = clone(afterState);
    this._lastRelativeMs = relativeMs;
    return event;
  }
  beginTrace(cell) {
    if (this.state.status !== "READY" || !isInBounds(cell))return false;
    this.state.status = "TRACING";
    this.path = [clone(cell)];
    this.log("trace_start", null, {
      cell, nodeType: this.state.board[indexOf(cell)]
    });
    return true;
  }
  extendTrace(cell) {
    if (this.state.status !== "TRACING")return"ignored";
    const result = advancePath(this.state.board, this.path, cell);
    this.path = result.path;
    if (result.action !== "ignored")this.log(`path_${result.action}`, null, {
      cell, path: clone(this.path)
    });
    return result.action;
  }
  cancelTrace(reason = "cancel") {
    if (this.state.status !== "TRACING")return false;
    const path = clone(this.path || []);
    this.path = [];
    this.state.status = "READY";
    this.log("trace_cancel", null, {
      reason, path
    });
    return true;
  }
  submitTrace(transactionId = null) {
    if (this.state.status !== "TRACING")return {
      valid: false, reason: "not_tracing"
    };
    const path = clone(this.path || []);
    this.path = [];
    this.state.status = "VALIDATING";
    if (path.length<3) {
      this.state.status = "READY";
      this.log("invalid_release", null, {
        path
      });
      return {
        valid: false, reason: "too_short"
      };
    }
    return this.resolvePath(path, transactionId);
  }
  resolvePath(path, transactionId = null) {
    const before = summarizeState(this.state);
    const beforeRng = this.rng.snapshot();
    try {
      let verified = [];
      for (const cell of path) {
        const result = advancePath(this.state.board, verified, cell);
        if (result.action !== "start" && result.action !== "append")throw new Error("invalid_path");
        verified = result.path;
      }
      if (verified.length<3)throw new Error("invalid_path");
      const tutorial = this.state.onboarding.enabled && this.state.onboarding.phase === "tutorial";
      if (tutorial) {
        const step = this.fixture.steps[this.state.onboarding.step];
        if (!step || !step.candidates.some((candidate) => sameRoute(candidate, verified))) {
          const restored = { ...clone(before), status: "READY" };
          this.state = { ...this.state, ...restored, stableSnapshot: clone(restored) };
          this.rng = createRng(this.seed, beforeRng.state, beforeRng.draws);
          this.state.status = "READY";
          this.log("onboarding_attempt_rejected", before, {
            step: this.state.onboarding.step, path: verified
          });
          return {
            valid: false, reason: "onboarding_target_mismatch", onboarding: clone(this.state.onboarding)
          };
        }
      }
      this.state.status = "RESOLVING";
      const onboardingPhaseBefore = this.state.onboarding.phase;
      const oldKeys = new Set(this.state.oldRoute.map(keyOf));
      const endpoint = verified[verified.length-1];
      const meeting = this.state.oldRoute.length>0 && oldKeys.has(keyOf(endpoint));
      const baseGrowth = verified.length;
      const meetingGrowth = meeting?4: 0;
      this.state.growth += baseGrowth+meetingGrowth;
      this.state.validHands += 1;
      const actingCat = this.state.currentCat;
      this.state.currentCat = actingCat === "A"?"B": "A";
      this.state.oldRoute = clone(verified);
      this.state.oldRouteCat = actingCat;
      this.state.status = "REFILLING";
      const replacements = [];
      for (const cell of verified) {
        const node = this.drawRefillNode();
        this.state.board[indexOf(cell)] = node;
        replacements.push({
          ...cell, node
        });
      }
      if (this.testFailAt === "after_refill")throw new Error("test_failure_after_refill");
      let missionEvent = null;
      if (this.state.mission.enabled && this.state.mission.active) {
        this.state.mission.hands += 1;
        if (meeting)this.state.mission.meetings += 1;
        if (this.state.mission.hands >= 8) {
          this.state.mission.active = false;
          if (this.state.mission.meetings >= 3) {
            this.state.mission.result = "complete";
            if (!this.state.mission.rewardGranted)this.state.mission.rewardGranted = true;
            missionEvent = "mission_complete";
          } else {
            this.state.mission.result = "incomplete";
            missionEvent = "mission_incomplete";
          }
        }
      }
      if (this.state.onboarding.enabled) {
        if (this.state.onboarding.phase === "tutorial") {
          this.state.onboarding.step += 1;
          if (this.state.onboarding.step >= this.fixture.steps.length)this.state.onboarding.phase = "calibration";
        } else if (this.state.onboarding.phase === "calibration") {
          this.state.onboarding.calibrationHands += 1;
          if (meeting)this.state.onboarding.calibrationMeetings += 1;
          if (this.state.onboarding.calibrationHands >= 8) {
            this.state.onboarding.phase = "complete";
            this.state.onboarding.result = this.state.onboarding.calibrationMeetings >= 2?"understood": "needs_practice";
          }
        }
      }
      let arrival = false;
      if (!this.state.mission.enabled && onboardingPhaseBefore === "complete") {
        this.state.journey.hands += 1;
        if (this.state.journey.hands >= 12) {
          this.state.journey.hands = 0;
          this.state.journey.completed += 1;
          arrival = true;
        }
      }
      const feedbackTier = arrival?"arrival": meeting?"meeting": verified.length >= 6?"long": "ordinary";
      this.state.feedbackTier = feedbackTier;
      this.refreshObjective();
      this.state.status = "CHECKING";
      const reshuffled = this.ensurePlayable("after_refill");
      this.state.status = "READY";
      this.state.stableSnapshot = summarizeState(this.state);
      const result = {
        valid: true,
        transactionId,
        path: verified,
        actingCat,
        meeting,
        baseGrowth,
        meetingGrowth,
        replacements,
        reshuffled,
        feedbackTier,
        arrival,
        mission: clone(this.state.mission),
        onboarding: clone(this.state.onboarding),
        journey: clone(this.state.journey)
      };
      this.log("valid_commit", before, result);
      this.log("base_growth", null, {
        amount: baseGrowth
      });
      if (meeting)this.log("meeting", null, {
        amount: meetingGrowth, endpoint
      });
      this.log("cat_rotate", null, {
        actingCat, nextCat: this.state.currentCat
      });
      this.log("refill", null, {
        replacements
      });
      if (this.state.mission.enabled)this.log("mission_hand", null, {
        hands: this.state.mission.hands, meetings: this.state.mission.meetings
      });
      if (missionEvent)this.log(missionEvent, null, {
        mission: clone(this.state.mission)
      });
      return result;
    } catch (error) {
      this.state = {
        ...this.state, ...clone(before), stableSnapshot: clone(before)
      };
      this.rng = createRng(this.seed, beforeRng.state, beforeRng.draws);
      this.state.status = "ERROR";
      this.log("transaction_error", before, {
        message: error.message
      });
      return {
        valid: false, reason: error.message, error: true
      };
    }
  }
  ensurePlayable(reason = "check") {
    if (hasLegalRoute(this.state.board)) {
      if (this.events)this.log("deadlock_check", null, {
        playable: true, reason
      });
      return false;
    }
    this.state.status = "RESHUFFLING";
    const beforeBoard = [...this.state.board];
    if (this.events)this.log("reshuffle_start", null, {
      reason, board: beforeBoard
    });
    let candidate = [...beforeBoard];
    let fallback = false;
    let attempts = 0;
    for (; attempts<this.reshuffleLimit; attempts += 1) {
      candidate = [...beforeBoard];
      for (let i = candidate.length-1; i>0; i -= 1) {
        const j = this.rng.int(i+1);
        [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
      }
      if (hasLegalRoute(candidate))break;
    }
    if (!hasLegalRoute(candidate)) {
      fallback = true;
      do{
        candidate = this.drawBoard();
      }
      while (!hasLegalRoute(candidate));
    }
    this.state.board = candidate;
    this.state.oldRoute = [];
    this.state.oldRouteCat = null;
    if (this.events && fallback)this.log("reshuffle_fallback", null, {
      reason, attempts: attempts+1
    });
    if (this.events)this.log("reshuffle_end", null, {
      reason, attempts: attempts+1, fallback, beforeBoard, board: [...candidate]
    });
    return true;
  }
  suspend() {
    if (this.state.status === "TRACING")this.cancelTrace("page_hidden");
    const previous = this.state.status;
    this.state.status = "SUSPENDED";
    this.log("page_hidden", null, {
      previous
    });
  }
  resume() {
    if (this.state.status === "SUSPENDED") {
      this.state.status = "READY";
      this.log("page_resumed", null);
    }
  }
  recoverStable() {
    if (!this.state.stableSnapshot)return false;
    const previous = summarizeState(this.state);
    this.state = {
      ...this.state, ...clone(this.state.stableSnapshot), status: "READY"
    };
    this.log("stable_snapshot_recovered", previous);
    return true;
  }
  exportData() {
    const stableSnapshot = clone(this.state.stableSnapshot || summarizeState(this.state));
    stableSnapshot.status = "READY";
    return {
      saveSchemaVersion: SAVE_SCHEMA_VERSION,
      eventVersion: EVENT_VERSION,
      buildVersion: BUILD_VERSION,
      seed: this.seed,
      mode: this.mode,
      rng: this.rng.snapshot(),
      sessionId: this.state.sessionId,
      eventSequence: this.eventSequence,
      exportNote: "Complete local event chain for this session. No silent truncation is applied.",
      stableSnapshot,
      state: summarizeState(this.state),
      events: clone(this.events)
    };
  }
}
