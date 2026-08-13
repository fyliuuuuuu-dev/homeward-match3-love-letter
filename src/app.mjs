import { GreyboxEngine } from "./engine.mjs";
import { parseSave, safeStorageRead, safeStorageWrite } from "./persistence.mjs";
import { createPresenter } from "./presentation.mjs";

const STORAGE_KEY = "homeward-match3-save-v1";
const SETTINGS_KEY = "homeward-match3-settings-v1";
const localStore = (() => { try { return window.localStorage; } catch { return null; } })();
const ui = Object.fromEntries(["boardWrap", "board", "pathLayer", "boardFx", "cat", "growth", "hands", "status", "mission", "catA", "catB", "meetingMark", "restart", "rulesButton", "mute", "motion", "seed", "missionToggle", "submitPath", "cancelPath", "copyLog", "downloadLog", "saveStatus", "rules", "closeRules"].map((id) => [id, document.getElementById(id)]));

let settings = { muted: true, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches };
const storedSettings = safeStorageRead(localStore, SETTINGS_KEY);
try { settings = { ...settings, ...JSON.parse(storedSettings.value || "{}") }; } catch {}
let engine;
let activePointer = null;
let transaction = 0;
let audioContext = null;
let suppressClickUntil = 0;
let keyboardActivation = null;

function configureCell(button) { button.tabIndex = 0; }
function focusCellButton(button) { button?.focus({ preventScroll: true }); }
function configurePathLayer(layer, geometry) {
  layer.setAttribute("viewBox", geometry.viewBox);
  layer.setAttribute("width", String(geometry.width));
  layer.setAttribute("height", String(geometry.height));
}
const presenter = createPresenter({ ui, configureCell, focusCellButton, configurePathLayer });
for (const portrait of document.querySelectorAll(".companion-portrait")) {
  portrait.addEventListener("error", () => portrait.parentElement?.classList.add("asset-missing"));
}

function loadSession() {
  const params = new URLSearchParams(location.search);
  const requestedSeed = Number(params.get("seed") || 32032) >>> 0;
  const requestedMission = params.get("mission") === "1";
  ui.seed.value = String(requestedSeed);
  ui.missionToggle.checked = requestedMission;
  const mode = requestedMission ? "mission" : "relax";
  const stored = safeStorageRead(localStore, STORAGE_KEY);
  const restored = stored.ok ? parseSave(stored.value, { seed: requestedSeed, mode }) : { ok: false, reason: stored.reason };
  if (restored.ok) {
    engine = GreyboxEngine.fromSave(restored.value);
    render("Restored the latest stable move");
  } else {
    engine = new GreyboxEngine({ seed: requestedSeed, missionEnabled: requestedMission });
    engine.log("restore_failed", null, { reason: restored.reason });
    render(restored.reason === "missing" ? "Connect at least three matching tiles" : "The local save was invalid, so a fresh game was created");
  }
  save();
}

function save() {
  const data = engine.exportData();
  data.savedAt = new Date().toISOString();
  const saveResult = safeStorageWrite(localStore, STORAGE_KEY, JSON.stringify(data));
  safeStorageWrite(localStore, SETTINGS_KEY, JSON.stringify(settings));
  ui.saveStatus.textContent = saveResult.ok
    ? `Local save: ${new Date(data.savedAt).toLocaleTimeString()}, seed ${engine.seed}, ${engine.state.validHands} moves`
    : "Local storage is unavailable. You can keep playing and export the session log.";
}

function cellFromEvent(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".cell");
  if (!target || !ui.board.contains(target)) return null;
  return { row: Number(target.dataset.row), column: Number(target.dataset.column) };
}

function render(message = null, result = null, focusCell = null, action = null) {
  presenter.render({ state: engine.state, path: engine.path || [], message, result, focusCell, action });
}

function tone(frequency = 330, duration = .06) {
  if (settings.muted) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.05, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

ui.board.addEventListener("pointerdown", (event) => {
  if (activePointer !== null || !event.isPrimary) return;
  const cell = cellFromEvent(event);
  if (!cell || !engine.beginTrace(cell)) return;
  activePointer = event.pointerId;
  ui.board.setPointerCapture(event.pointerId);
  event.preventDefault();
  presenter.clearTransient("start");
  render("Keep dragging through matching adjacent tiles");
});

ui.board.addEventListener("pointermove", (event) => {
  if (event.pointerId !== activePointer) return;
  const cell = cellFromEvent(event);
  if (!cell) return;
  const action = engine.extendTrace(cell);
  if (action !== "ignored") {
    tone(action === "backtrack" || action === "truncate" ? 220 : 300 + engine.path.length * 30);
    render(action === "backtrack" || action === "truncate" ? "Path shortened" : `${engine.path.length} tiles`, null, null, action);
  }
  event.preventDefault();
});

function finishPointer(event, cancelled = false) {
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  suppressClickUntil = performance.now() + 350;
  if (cancelled) {
    engine.cancelTrace("pointer_cancel");
    presenter.clearTransient("cancel");
    render("Gesture canceled. Start a new path when ready.");
    return;
  }
  const result = engine.submitTrace(`ui-${++transaction}`);
  if (!result.valid) {
    presenter.clearTransient("cancel");
    render("Connect at least three tiles. This move was not counted.");
    tone(180);
  } else {
    const message = result.meeting ? `Rendezvous: ${result.baseGrowth} path points plus a 4-point bonus` : `Cleared ${result.baseGrowth} tiles. The previous route is now marked.`;
    render(message, result);
    tone(result.meeting ? 660 : 440, .1);
    save();
  }
}
ui.board.addEventListener("pointerup", (event) => finishPointer(event));
ui.board.addEventListener("pointercancel", (event) => finishPointer(event, true));
ui.board.addEventListener("contextmenu", (event) => event.preventDefault());

function selectCellForAccessiblePath(selectedCell) {
  if (engine.state.status === "READY") {
    engine.beginTrace(selectedCell);
    presenter.clearTransient("start");
    render("Accessible path started. Choose another adjacent matching tile.", null, selectedCell);
    return "start";
  } else if (engine.state.status === "TRACING") {
    const action = engine.extendTrace(selectedCell);
    if (action !== "ignored") render(`${engine.path.length} tiles selected. Submit or cancel the path.`, null, selectedCell, action);
    return action;
  }
  return "ignored";
}

function cellFromButton(target) {
  return { row: Number(target.dataset.row), column: Number(target.dataset.column) };
}

ui.board.addEventListener("keydown", (event) => {
  const target = event.target.closest?.(".cell");
  if (!target || !ui.board.contains(target) || (event.key !== "Enter" && event.key !== " " && event.key !== "Space" && event.key !== "Spacebar")) return;
  event.preventDefault();
  event.stopPropagation();
  const selectedCell = cellFromButton(target);
  keyboardActivation = { key: `${selectedCell.row},${selectedCell.column}`, until: performance.now() + 120 };
  selectCellForAccessiblePath(selectedCell);
});

ui.board.addEventListener("click", (event) => {
  if (performance.now() < suppressClickUntil) return;
  const target = event.target.closest(".cell");
  if (!target) return;
  const selectedCell = cellFromButton(target);
  const key = `${selectedCell.row},${selectedCell.column}`;
  if (keyboardActivation && performance.now() < keyboardActivation.until && keyboardActivation.key === key) {
    keyboardActivation = null;
    return;
  }
  keyboardActivation = null;
  selectCellForAccessiblePath(selectedCell);
});

function submitKeyboardPath() {
  if (engine.state.status !== "TRACING") return;
  const result = engine.submitTrace(`keyboard-${++transaction}`);
  if (!result.valid) {
    presenter.clearTransient("cancel");
    render("Connect at least three tiles. This move was not counted.");
  }
  else {
    render(result.meeting ? `Rendezvous: ${result.baseGrowth} path points plus a 4-point bonus` : `Cleared ${result.baseGrowth} tiles. The previous route is now marked.`, result);
    save();
  }
}
function cancelKeyboardPath() {
  if (engine.cancelTrace("keyboard_cancel")) {
    presenter.clearTransient("cancel");
    render("Path canceled");
  }
}
ui.submitPath.addEventListener("click", submitKeyboardPath);
ui.cancelPath.addEventListener("click", cancelKeyboardPath);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && engine.state.status === "TRACING") {
    event.preventDefault();
    cancelKeyboardPath();
  }
});

function restart() {
  const seed = Number(ui.seed.value) >>> 0;
  const missionEnabled = ui.missionToggle.checked;
  engine = new GreyboxEngine({ seed, missionEnabled });
  history.replaceState(null, "", `?seed=${seed}${missionEnabled ? "&mission=1" : ""}`);
  activePointer = null;
  presenter.clearTransient("restart");
  render("Restarted with the selected seed");
  save();
}
ui.restart.addEventListener("click", restart);
ui.missionToggle.addEventListener("change", restart);
ui.rulesButton.addEventListener("click", () => { ui.rules.showModal(); ui.rulesButton.setAttribute("aria-expanded", "true"); });
ui.closeRules.addEventListener("click", () => { ui.rules.close(); ui.rulesButton.setAttribute("aria-expanded", "false"); });
ui.rules.addEventListener("close", () => ui.rulesButton.setAttribute("aria-expanded", "false"));
ui.mute.addEventListener("click", () => {
  settings.muted = !settings.muted;
  ui.mute.textContent = `Sound: ${settings.muted ? "off" : "on"}`;
  ui.mute.setAttribute("aria-pressed", String(settings.muted));
  engine.log("mute_toggle", null, { muted: settings.muted });
  if (!settings.muted) tone(440);
  save();
});
ui.motion.addEventListener("click", () => {
  settings.reducedMotion = !settings.reducedMotion;
  applySettings();
  engine.log("reduced_motion_toggle", null, { reducedMotion: settings.reducedMotion });
  save();
});

function applySettings() {
  presenter.applyPreferences({ reducedMotion: settings.reducedMotion });
  ui.mute.textContent = `Sound: ${settings.muted ? "off" : "on"}`;
  ui.mute.setAttribute("aria-pressed", String(settings.muted));
  ui.motion.textContent = `Reduced motion: ${settings.reducedMotion ? "on" : "off"}`;
  ui.motion.setAttribute("aria-pressed", String(settings.reducedMotion));
}

function logText() { return JSON.stringify(engine.exportData(), null, 2); }
ui.copyLog.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(logText()); ui.saveStatus.textContent = "Session log copied"; }
  catch { ui.saveStatus.textContent = "Clipboard access was denied. Use Download log instead."; }
});
ui.downloadLog.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([logText()], { type: "application/json" }));
  link.download = `homeward-session-${engine.seed}-${engine.state.sessionId}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { engine.suspend(); activePointer = null; presenter.clearTransient("suspend"); save(); }
  else { engine.resume(); presenter.clearTransient("resume"); render("Resumed. Any unfinished gesture was canceled."); }
});
window.addEventListener("pagehide", () => { engine.log("session_end", null); save(); });

applySettings();
loadSession();
