import { BUILD_VERSION, EVENT_VERSION, SAVE_SCHEMA_VERSION, ROWS, COLUMNS, NODE_TYPES } from "./engine.mjs";
export const LEGACY_BUILD_VERSION = "homeward-prototype-0.1.0";
export const LEGACY_EVENT_VERSION = 1;
const isInt = (value, min = 0) => Number.isInteger(value) && value >= min;
const validCell = (cell) => cell && isInt(cell.row) && cell.row<ROWS && isInt(cell.column) && cell.column<COLUMNS;
const stateKeys = [
  "status", "board", "oldRoute", "oldRouteCat", "currentCat", "growth",
  "validHands", "mission", "onboarding", "journey", "feedbackTier", "objective"
];
const forbiddenKeys = new Set([
  "name", "email", "phone", "location", "photo", "recording", "address",
  "account", "contact", "url", "ip", "deviceid", "filepath", "filename",
  "absolutepath"
]);
const saveKeys = new Set([
  "saveSchemaVersion", "eventVersion", "buildVersion", "seed", "mode", "rng",
  "sessionId", "eventSequence", "exportNote", "stableSnapshot", "state",
  "events", "savedAt", "migrationSource"
]);
const eventKeys = new Set([
  "eventVersion", "buildVersion", "sessionId", "sequence", "relativeMs", "mode",
  "seed", "randomDraw", "before", "after", "type", "payload", "migrationSource"
]);
function validState(state) {
  if (!state || typeof state !== "object" || stateKeys.some((key) => !(key in state)))return false;
  if (!Array.isArray(state.board) || state.board.length !== ROWS*COLUMNS || state.board.some((node) => !isInt(node) || node >= NODE_TYPES))return false;
  if (!Array.isArray(state.oldRoute) || state.oldRoute.some((cell) => !validCell(cell)))return false;
  if (state.oldRoute.length === 0?state.oldRouteCat !== null: !['A', 'B'].includes(state.oldRouteCat))return false;
  if (!['LOADING', 'READY', 'TRACING', 'VALIDATING', 'RESOLVING', 'REFILLING', 'CHECKING', 'RESHUFFLING', 'SUSPENDED', 'ERROR'].includes(state.status))return false;
  if (!['A', 'B'].includes(state.currentCat) || !isInt(state.growth) || !isInt(state.validHands))return false;
  const mission = state.mission;
  const onboarding = state.onboarding;
  const journey = state.journey;
  const missionValid = !!mission &&
    typeof mission.enabled === "boolean" &&
    typeof mission.active === "boolean" &&
    isInt(mission.hands) &&
    isInt(mission.meetings) &&
    [null, "complete", "incomplete"].includes(mission.result) &&
    typeof mission.rewardGranted === "boolean";
  const onboardingValid = !!onboarding &&
    typeof onboarding.enabled === "boolean" &&
    ["tutorial", "calibration", "complete"].includes(onboarding.phase) &&
    isInt(onboarding.step) &&
    isInt(onboarding.calibrationHands) &&
    isInt(onboarding.calibrationMeetings) &&
    [null, "understood", "needs_practice"].includes(onboarding.result) &&
    (onboarding.fixtureId === null || onboarding.fixtureId === "three-minute-v1") &&
    isInt(onboarding.randomCursor) &&
    (onboarding.target === null || typeof onboarding.target === "string") &&
    Array.isArray(onboarding.candidates);
  const journeyValid = !!journey &&
    isInt(journey.hands) && journey.hands<12 && isInt(journey.completed);
  const feedbackValid = [null, "ordinary", "long", "meeting", "arrival"]
    .includes(state.feedbackTier);
  const objectiveValid = !!state.objective &&
    ["tutorial", "calibration", "mission", "journey"].includes(state.objective.kind) &&
    typeof state.objective.text === "string" &&
    isInt(state.objective.remaining);
  return missionValid && onboardingValid && journeyValid && feedbackValid && objectiveValid;
}
const legacyStateKeys = new Set(["status", "board", "oldRoute", "currentCat", "growth", "validHands", "mission"]);
function migrateStateV1(s) {
  if (!s || typeof s !== "object" || Object.keys(s).some(k => !legacyStateKeys.has(k)))throw Error("invalid_legacy_state");
  const v = {
    status: s.status, board: [...s.board], oldRoute: s.oldRoute.map(c => ({
      ...c
    })), oldRouteCat: s.oldRoute.length?"A": null, currentCat: s.currentCat, growth: s.growth, validHands: s.validHands, mission: {
      ...s.mission
    }, onboarding: {
      enabled: false, phase: "complete", step: 0, calibrationHands: 0, calibrationMeetings: 0, result: null, fixtureId: null, randomCursor: 0, target: null, candidates: []
    }, journey: {
      hands: s.mission.enabled?0: s.validHands%12, completed: s.mission.enabled?0: Math.floor(s.validHands/12)
    }, feedbackTier: null, objective: s.mission.enabled?{
      kind: "mission", text: "Make three rendezvous within eight moves", remaining: Math.max(0, 8-s.mission.hands)
    }
    : {
      kind: "journey", text: "Complete this journey", remaining: 12-s.validHands%12
    }
  };
  if (!validState(v))throw Error("invalid_legacy_state");
  return v;
}
export function migrateV1ToV2(legacy) {
  try {
    if (!legacy || typeof legacy !== "object" || legacy.buildVersion !== LEGACY_BUILD_VERSION || legacy.eventVersion !== LEGACY_EVENT_VERSION)return {
      ok: false, reason: "not_v1"
    };
    if (!Array.isArray(legacy.events) || legacy.events.length === 0 || legacy.eventSequence !== legacy.events.length)return {
      ok: false, reason: "invalid_legacy_events"
    };
    let previousAfter = null;
    const events = legacy.events.map((event, index) => {
      const eventValid = event &&
        event.sequence === index+1 &&
        event.eventVersion === LEGACY_EVENT_VERSION &&
        event.buildVersion === LEGACY_BUILD_VERSION &&
        event.sessionId === legacy.sessionId &&
        isInt(event.relativeMs) &&
        isInt(event.randomDraw);
      if (!eventValid)throw new Error("invalid_legacy_event");
      if (previousAfter && JSON.stringify(event.before) !== JSON.stringify(previousAfter)) {
        throw new Error("legacy_event_state_discontinuity");
      }
      previousAfter = event.after;
      return {
        ...JSON.parse(JSON.stringify(event)), eventVersion: EVENT_VERSION, buildVersion: BUILD_VERSION, migrationSource: {
          eventVersion: LEGACY_EVENT_VERSION, buildVersion: LEGACY_BUILD_VERSION
        }, before: migrateStateV1(event.before), after: migrateStateV1(event.after)
      };
    });
    const migrated = {
      ...JSON.parse(JSON.stringify(legacy)), saveSchemaVersion: SAVE_SCHEMA_VERSION, eventVersion: EVENT_VERSION, buildVersion: BUILD_VERSION, migrationSource: {
        saveSchemaVersion: 1, eventVersion: LEGACY_EVENT_VERSION, buildVersion: LEGACY_BUILD_VERSION
      }, stableSnapshot: migrateStateV1(legacy.stableSnapshot), state: legacy.state?migrateStateV1(legacy.state): migrateStateV1(legacy.stableSnapshot), events
    };
    const checked = validateSave(migrated);
    return checked.ok?{
      ok: true, value: migrated
    }
    : checked;
  } catch (error) {
    return {
      ok: false, reason: error.message || "migration_failed"
    };
  }
}
function hasPrivateKey(value) {
  if (!value || typeof value !== "object")return false;
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key.toLowerCase()) || hasPrivateKey(child));
}
export function validateEvents(events, candidate) {
  if (!Array.isArray(events) || events.length === 0)return {
    ok: false, reason: "invalid_events"
  };
  let previousTime = -1;
  let previousAfter = null;
  for (let index = 0; index<events.length; index += 1) {
    const event = events[index];
    if (!event || typeof event !== "object")return {
      ok: false, reason: "invalid_event"
    };
    if (Object.keys(event).some((key) => !eventKeys.has(key)))return {
      ok: false, reason: "unknown_event_field"
    };
    if (event.eventVersion !== EVENT_VERSION || event.buildVersion !== BUILD_VERSION)return {
      ok: false, reason: "event_version_mismatch"
    };
    if (event.sessionId !== candidate.sessionId)return {
      ok: false, reason: "event_session_mismatch"
    };
    if (event.sequence !== index+1)return {
      ok: false, reason: "event_sequence_gap"
    };
    if (typeof event.type !== "string" || !event.type || !event.payload || typeof event.payload !== "object")return {
      ok: false, reason: "invalid_event_fields"
    };
    if (!isInt(event.relativeMs) || event.relativeMs<previousTime)return {
      ok: false, reason: "event_time_not_monotonic"
    };
    if (event.mode !== candidate.mode || event.seed !== candidate.seed || !isInt(event.randomDraw))return {
      ok: false, reason: "event_context_mismatch"
    };
    if (!validState(event.before) || !validState(event.after))return {
      ok: false, reason: "invalid_event_state"
    };
    if (previousAfter !== null && JSON.stringify(event.before) !== JSON.stringify(previousAfter))return {
      ok: false, reason: "event_state_discontinuity"
    };
    if (hasPrivateKey(event))return {
      ok: false, reason: "private_event_field"
    };
    previousTime = event.relativeMs;
    previousAfter = event.after;
  }
  if (candidate.eventSequence !== events.length)return {
    ok: false, reason: "event_sequence_mismatch"
  };
  return {
    ok: true
  };
}
export function validateSave(candidate, {
  seed, mode
}
= {
}) {
  if (!candidate || typeof candidate !== "object")return {
    ok: false, reason: "not_an_object"
  };
  if (Object.keys(candidate).some((key) => !saveKeys.has(key)))return {
    ok: false, reason: "unknown_save_field"
  };
  if (candidate.saveSchemaVersion !== SAVE_SCHEMA_VERSION)return {
    ok: false, reason: "save_schema_mismatch"
  };
  if (candidate.buildVersion !== BUILD_VERSION)return {
    ok: false, reason: "build_version_mismatch"
  };
  if (candidate.eventVersion !== EVENT_VERSION)return {
    ok: false, reason: "event_version_mismatch"
  };
  if (!isInt(candidate.seed) || candidate.seed>0xffffffff)return {
    ok: false, reason: "invalid_seed"
  };
  if (seed !== undefined && candidate.seed !== (Number(seed) >>> 0))return {
    ok: false, reason: "seed_mismatch"
  };
  if (!['relax', 'mission'].includes(candidate.mode))return {
    ok: false, reason: "invalid_mode"
  };
  if (mode !== undefined && candidate.mode !== mode)return {
    ok: false, reason: "mode_mismatch"
  };
  if (!candidate.rng || !isInt(candidate.rng.state) || candidate.rng.state>0xffffffff || !isInt(candidate.rng.draws))return {
    ok: false, reason: "invalid_rng"
  };
  if (typeof candidate.sessionId !== "string" || !candidate.sessionId.startsWith("local-"))return {
    ok: false, reason: "invalid_session"
  };
  if (!isInt(candidate.eventSequence))return {
    ok: false, reason: "invalid_event_sequence"
  };
  const state = candidate.stableSnapshot;
  if (!state || typeof state !== "object")return {
    ok: false, reason: "missing_stable_snapshot"
  };
  if (!validState(state))return {
    ok: false, reason: "invalid_stable_snapshot"
  };
  const mission = state.mission;
  if (!mission || typeof mission.enabled !== "boolean" || typeof mission.active !== "boolean" || !isInt(mission.hands) || !isInt(mission.meetings) || ![null, "complete", "incomplete"].includes(mission.result) || typeof mission.rewardGranted !== "boolean")return {
    ok: false, reason: "invalid_mission"
  };
  if ((candidate.mode === "mission") !== mission.enabled)return {
    ok: false, reason: "mission_mode_mismatch"
  };
  const eventCheck = validateEvents(candidate.events, candidate);
  if (!eventCheck.ok)return eventCheck;
  if (hasPrivateKey(candidate))return {
    ok: false, reason: "private_save_field"
  };
  return {
    ok: true, value: candidate
  };
}
export function parseSave(raw, expected = {
}) {
  if (!raw)return {
    ok: false, reason: "missing"
  };
  try {
    const parsed = JSON.parse(raw);
    const result = parsed.buildVersion === LEGACY_BUILD_VERSION && parsed.eventVersion === LEGACY_EVENT_VERSION?migrateV1ToV2(parsed): validateSave(parsed, expected);
    if (!result.ok)return result;
    return validateSave(result.value, expected);
  } catch {
    return {
      ok: false, reason: "invalid_json"
    };
  }
}
export function safeStorageRead(storage, key) {
  try {
    return {
      ok: true, value: storage.getItem(key)
    };
  } catch (error) {
    return {
      ok: false, value: null, reason: "storage_read_failed", detail: error?.name || "Error"
    };
  }
}
export function safeStorageWrite(storage, key, value) {
  try {
    storage.setItem(key, value);
    return {
      ok: true
    };
  } catch (error) {
    return {
      ok: false, reason: "storage_write_failed", detail: error?.name || "Error"
    };
  }
}
export function readSaveWithMigration(storage, {
  v2Key, v1Key, expected = {
  }
}) {
  const current = safeStorageRead(storage, v2Key);
  const parsedCurrent = current.ok?parseSave(current.value, expected): {
    ok: false, reason: current.reason
  };
  if (parsedCurrent.ok)return {
    ...parsedCurrent, migrated: false, migrationWrite: {
      ok: true
    }
  };
  const legacy = safeStorageRead(storage, v1Key);
  const parsedLegacy = legacy.ok?parseSave(legacy.value, expected): {
    ok: false, reason: legacy.reason
  };
  if (!parsedLegacy.ok)return parsedCurrent.reason !== "missing"?parsedCurrent: parsedLegacy;
  const migrationWrite = safeStorageWrite(storage, v2Key, JSON.stringify(parsedLegacy.value));
  return {
    ok: true, value: parsedLegacy.value, migrated: true, migrationWrite
  };
}
