import { BUILD_VERSION, EVENT_VERSION, ROWS, COLUMNS, NODE_TYPES } from "./engine.mjs";

const isInt = (value, min = 0) => Number.isInteger(value) && value >= min;
const validCell = (cell) => cell && isInt(cell.row) && cell.row < ROWS && isInt(cell.column) && cell.column < COLUMNS;
const stateKeys = ["status", "board", "oldRoute", "currentCat", "growth", "validHands", "mission"];
const forbiddenKeys = new Set(["name", "email", "phone", "location", "photo", "recording", "address", "account", "contact"]);

function validState(state) {
  if (!state || typeof state !== "object" || stateKeys.some((key) => !(key in state))) return false;
  if (!Array.isArray(state.board) || state.board.length !== ROWS * COLUMNS || state.board.some((node) => !isInt(node) || node >= NODE_TYPES)) return false;
  if (!Array.isArray(state.oldRoute) || state.oldRoute.some((cell) => !validCell(cell))) return false;
  if (!['LOADING', 'READY', 'TRACING', 'VALIDATING', 'RESOLVING', 'REFILLING', 'CHECKING', 'RESHUFFLING', 'SUSPENDED', 'ERROR'].includes(state.status)) return false;
  if (!['A', 'B'].includes(state.currentCat) || !isInt(state.growth) || !isInt(state.validHands)) return false;
  const mission = state.mission;
  return !!mission && typeof mission.enabled === "boolean" && typeof mission.active === "boolean" && isInt(mission.hands) && isInt(mission.meetings) && [null, "complete", "incomplete"].includes(mission.result) && typeof mission.rewardGranted === "boolean";
}

function hasPrivateKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key.toLowerCase()) || hasPrivateKey(child));
}

export function validateEvents(events, candidate) {
  if (!Array.isArray(events) || events.length === 0) return { ok: false, reason: "invalid_events" };
  let previousTime = -1;
  let previousAfter = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || typeof event !== "object") return { ok: false, reason: "invalid_event" };
    if (event.eventVersion !== EVENT_VERSION || event.buildVersion !== BUILD_VERSION) return { ok: false, reason: "event_version_mismatch" };
    if (event.sessionId !== candidate.sessionId) return { ok: false, reason: "event_session_mismatch" };
    if (event.sequence !== index + 1) return { ok: false, reason: "event_sequence_gap" };
    if (typeof event.type !== "string" || !event.type || !event.payload || typeof event.payload !== "object") return { ok: false, reason: "invalid_event_fields" };
    if (!isInt(event.relativeMs) || event.relativeMs < previousTime) return { ok: false, reason: "event_time_not_monotonic" };
    if (event.mode !== candidate.mode || event.seed !== candidate.seed || !isInt(event.randomDraw)) return { ok: false, reason: "event_context_mismatch" };
    if (!validState(event.before) || !validState(event.after)) return { ok: false, reason: "invalid_event_state" };
    if (previousAfter !== null && JSON.stringify(event.before) !== JSON.stringify(previousAfter)) return { ok: false, reason: "event_state_discontinuity" };
    if (hasPrivateKey(event)) return { ok: false, reason: "private_event_field" };
    previousTime = event.relativeMs;
    previousAfter = event.after;
  }
  if (candidate.eventSequence !== events.length) return { ok: false, reason: "event_sequence_mismatch" };
  return { ok: true };
}

export function validateSave(candidate, { seed, mode } = {}) {
  if (!candidate || typeof candidate !== "object") return { ok: false, reason: "not_an_object" };
  if (candidate.buildVersion !== BUILD_VERSION) return { ok: false, reason: "build_version_mismatch" };
  if (candidate.eventVersion !== EVENT_VERSION) return { ok: false, reason: "event_version_mismatch" };
  if (!isInt(candidate.seed) || candidate.seed > 0xffffffff) return { ok: false, reason: "invalid_seed" };
  if (seed !== undefined && candidate.seed !== (Number(seed) >>> 0)) return { ok: false, reason: "seed_mismatch" };
  if (!['relax', 'mission'].includes(candidate.mode)) return { ok: false, reason: "invalid_mode" };
  if (mode !== undefined && candidate.mode !== mode) return { ok: false, reason: "mode_mismatch" };
  if (!candidate.rng || !isInt(candidate.rng.state) || candidate.rng.state > 0xffffffff || !isInt(candidate.rng.draws)) return { ok: false, reason: "invalid_rng" };
  if (typeof candidate.sessionId !== "string" || !candidate.sessionId.startsWith("local-")) return { ok: false, reason: "invalid_session" };
  if (!isInt(candidate.eventSequence)) return { ok: false, reason: "invalid_event_sequence" };
  const state = candidate.stableSnapshot;
  if (!state || typeof state !== "object") return { ok: false, reason: "missing_stable_snapshot" };
  if (!validState(state)) return { ok: false, reason: "invalid_stable_snapshot" };
  const mission = state.mission;
  if (!mission || typeof mission.enabled !== "boolean" || typeof mission.active !== "boolean" || !isInt(mission.hands) || !isInt(mission.meetings) || ![null, "complete", "incomplete"].includes(mission.result) || typeof mission.rewardGranted !== "boolean") return { ok: false, reason: "invalid_mission" };
  if ((candidate.mode === "mission") !== mission.enabled) return { ok: false, reason: "mission_mode_mismatch" };
  const eventCheck = validateEvents(candidate.events, candidate);
  if (!eventCheck.ok) return eventCheck;
  return { ok: true, value: candidate };
}

export function parseSave(raw, expected = {}) {
  if (!raw) return { ok: false, reason: "missing" };
  try { return validateSave(JSON.parse(raw), expected); }
  catch { return { ok: false, reason: "invalid_json" }; }
}

export function safeStorageRead(storage, key) {
  try { return { ok: true, value: storage.getItem(key) }; }
  catch (error) { return { ok: false, value: null, reason: "storage_read_failed", detail: error?.name || "Error" }; }
}

export function safeStorageWrite(storage, key, value) {
  try { storage.setItem(key, value); return { ok: true }; }
  catch (error) { return { ok: false, reason: "storage_write_failed", detail: error?.name || "Error" }; }
}
