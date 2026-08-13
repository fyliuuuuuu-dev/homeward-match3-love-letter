import { svgPathGeometry } from "./ui-utils.mjs";
const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_ROWS = 7;
const DEFAULT_COLUMNS = 6;
const TRANSIENT_MS = 760;
const RESHUFFLE_MS = 940;
export const TILE_ASSET_FILES = Object.freeze([
  "t001_pebble_dots.svg",
  "t002_cushion_grid.svg",
  "t003_diamond_ripples.svg",
  "t004_hex_honeycomb.svg",
  "t005_flower_stitches.svg"
]);
const cloneCell = ({
  row, column
}) => ({
  row, column
});
const cloneCells = (cells = []) => cells.map(cloneCell);
const cellKey = ({
  row, column
}) => `${row},${column}`;
export function createPresentationModel({
  state, path = [], action = null, result = null
}) {
  const authoritativePath = result?.valid === true?cloneCells(result.path || []): [];
  const replacements = result?.valid === true?(result.replacements || []).map(({
    row, column, node
  }) => ({
    row, column, node
  })): [];
  return Object.freeze({
    oldRoute: cloneCells(state?.oldRoute || []),
    oldRouteCat: state?.oldRouteCat || null,
    path: cloneCells(path),
    traceFeedback: action && action !== "ignored"?action: null,
    resolveCells: authoritativePath,
    replacements,
    meetingEndpoint: result?.valid === true && result.meeting === true && authoritativePath.length
      ? cloneCell(authoritativePath.at(-1))
      : null,
    reshuffled: result?.reshuffled === true,
    feedbackTier: result?.valid === true?result.feedbackTier: null,
    objective: state?.objective?{
      ...state.objective
    }
    : null,
    onboardingCandidates: cloneCells((state?.onboarding?.candidates || []).flat())
  });
}
function svgElement(name, attributes = {
}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const[key, value]of Object.entries(attributes))element.setAttribute(key, String(value));
  return element;
}
function lowEndSession(navigatorLike) {
  const memory = Number(navigatorLike?.deviceMemory);
  const cores = Number(navigatorLike?.hardwareConcurrency);
  return(Number.isFinite(memory) && memory>0 && memory <= 4) || (Number.isFinite(cores) && cores>0 && cores <= 4);
}
export function createPresenter({
  ui,
  body = document.body,
  navigatorLike = globalThis.navigator,
  rows = DEFAULT_ROWS,
  columns = DEFAULT_COLUMNS,
  typeLabels = ["pebble", "cushion", "diamond", "hexagon", "flower"],
  assetBase = "assets/tiles/",
  configureCell = (button) => {
    button.tabIndex = 0;
  },
  focusCellButton = (button) => button?.focus({
    preventScroll: true
  }),
  configurePathLayer = (layer, geometry) => {
    layer.setAttribute("viewBox", geometry.viewBox);
    layer.setAttribute("width", String(geometry.width));
    layer.setAttribute("height", String(geometry.height));
  }
}) {
  let transientTimer = null;
  let generation = 0;
  let reducedMotion = false;
  const lowEnd = lowEndSession(navigatorLike);
  body.classList.toggle("low-end", lowEnd);
  function clearTransient(reason = "clear") {
    generation += 1;
    if (transientTimer !== null)clearTimeout(transientTimer);
    transientTimer = null;
    ui.boardFx.replaceChildren();
    ui.board.removeAttribute("data-trace-feedback");
    ui.meetingMark.parentElement.classList.remove("meeting");
    ui.boardWrap?.removeAttribute("data-transient-reason");
    if (ui.boardWrap)ui.boardWrap.dataset.transientReason = reason;
  }
  function centerOf({
    row, column
  }, width, height) {
    return {
      x: ((column+0.5)/columns)*width, y: ((row+0.5)/rows)*height
    };
  }
  function renderPath(model) {
    ui.pathLayer.replaceChildren();
    if (!model.path.length)return;
    const rect = ui.board.getBoundingClientRect();
    const geometry = svgPathGeometry(rect.width, rect.height, model.path);
    configurePathLayer(ui.pathLayer, geometry);
    ui.pathLayer.append(svgElement("polyline", {
      class: "route-line", "data-module": "F002", points: geometry.points
    }));
    const points = model.path.map((entry) => centerOf(entry, rect.width, rect.height));
    if (!lowEnd) {
      for (let index = 1; index<points.length-1; index += 1) {
        ui.pathLayer.append(svgElement("circle", {
          class: "direction-beat", cx: points[index].x, cy: points[index].y, r: 3.5, "aria-hidden": "true"
        }));
      }
    }
    const endpoint = points.at(-1);
    ui.pathLayer.append(svgElement("circle", {
      class: "endpoint-cap", cx: endpoint.x, cy: endpoint.y, r: 7, "aria-hidden": "true"
    }));
    if (model.traceFeedback === "backtrack" || model.traceFeedback === "truncate") {
      ui.pathLayer.append(svgElement("path", {
        class: "backtrack-hook", "data-action": model.traceFeedback, d: `M${endpoint.x + 7} ${endpoint.y - 13} C${endpoint.x + 20} ${endpoint.y - 13} ${endpoint.x + 20} ${endpoint.y + 7} ${endpoint.x + 6} ${endpoint.y + 7} M${endpoint.x + 6} ${endpoint.y + 7} l6 -6 M${endpoint.x + 6} ${endpoint.y + 7} l7 5`, "aria-hidden": "true"
      }));
    }
    if (model.traceFeedback)ui.board.dataset.traceFeedback = model.traceFeedback;
  }
  function renderBoard(state, model, focusCell) {
    const oldRoute = new Set(model.oldRoute.map(cellKey));
    const selected = new Set(model.path.map(cellKey));
    const hinted = new Set(model.onboardingCandidates.map(cellKey));
    ui.board.replaceChildren();
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row*columns+column;
        const type = state.board[index];
        const key = `${row},${column}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.row = String(row);
        button.dataset.column = String(column);
        configureCell(button);
        button.setAttribute("aria-pressed", String(selected.has(key)));
        button.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}, ${typeLabels[type]}${oldRoute.has(key) ? ", previous route" : ""}`);
        if (oldRoute.has(key)) {
          button.classList.add("has-old-route");
          button.dataset.oldRouteModule = "F001";
          button.dataset.oldRouteCat = model.oldRouteCat;
        }
        if (selected.has(key))button.classList.add("selected");
        if (hinted.has(key))button.classList.add("onboarding-hint");
        const image = document.createElement("img");
        image.className = "tile-image";
        image.src = `${assetBase}${TILE_ASSET_FILES[type]}`;
        image.alt = "";
        image.draggable = false;
        image.setAttribute("aria-hidden", "true");
        button.append(image);
        ui.board.append(button);
      }
    }
    renderPath(model);
    if (focusCell) {
      const selector = `.cell[data-row="${focusCell.row}"][data-column="${focusCell.column}"]`;
      focusCellButton(ui.board.querySelector(selector));
    }
  }
  function placeMark(className, cell, moduleName) {
    const rect = ui.board.getBoundingClientRect();
    const point = centerOf(cell, rect.width, rect.height);
    const mark = document.createElement("span");
    mark.className = className;
    mark.dataset.module = moduleName;
    mark.setAttribute("aria-hidden", "true");
    mark.style.left = `${point.x}px`;
    mark.style.top = `${point.y}px`;
    ui.boardFx.append(mark);
    return mark;
  }
  function renderEffects(model, result) {
    if (model.feedbackTier)ui.boardWrap.dataset.feedbackTier = model.feedbackTier;
    const replacementByCell = new Map(model.replacements.map((entry) => [cellKey(entry), entry.node]));
    for (const cell of model.resolveCells) {
      const mark = placeMark("resolve-mark", cell, "F003");
      const replacement = replacementByCell.get(cellKey(cell));
      if (replacement !== undefined)mark.dataset.replacement = String(replacement);
    }
    if (model.meetingEndpoint) {
      const meeting = placeMark("meeting-mark", model.meetingEndpoint, "F004");
      const contact = document.createElement("span");
      contact.className = "contact-mark";
      contact.setAttribute("aria-hidden", "true");
      meeting.append(contact);
      ui.meetingMark.parentElement.classList.add("meeting");
    }
    if (model.reshuffled) {
      const reshuffle = document.createElement("span");
      reshuffle.className = "reshuffle-board";
      reshuffle.dataset.module = "F005";
      reshuffle.dataset.emotion = "neutral";
      reshuffle.setAttribute("aria-hidden", "true");
      ui.boardFx.append(reshuffle);
    }
    if (model.feedbackTier === "arrival") {
      const arrival = document.createElement("span");
      arrival.className = "arrival-board";
      arrival.dataset.feedbackTier = model.feedbackTier;
      arrival.setAttribute("aria-hidden", "true");
      ui.boardFx.append(arrival);
    }
    if (result?.valid === true) {
      const ownGeneration = generation;
      transientTimer = setTimeout(() => {
        if (ownGeneration !== generation) return;
        clearTransient("elapsed");
      }, model.reshuffled ? RESHUFFLE_MS : TRANSIENT_MS);
    }
  }
  function render({
    state, path = [], message = null, action = null, result = null, focusCell = null
  }) {
    clearTransient("render");
    const model = createPresentationModel({
      state, path, action, result
    });
    renderBoard(state, model, focusCell);
    ui.cat.textContent = `Cat ${state.currentCat}`;
    ui.growth.textContent = String(state.growth);
    ui.target.textContent = model.objective?.text || "Free play";
    ui.remaining.textContent = `${model.objective?.remaining ?? 0} moves`;
    ui.catA.classList.toggle("active", state.currentCat === "A");
    ui.catB.classList.toggle("active", state.currentCat === "B");
    ui.status.textContent = message || "Connect at least three matching tiles";
    const mission = state.mission;
    ui.mission.hidden = !mission.enabled;
    if (mission.enabled) {
      ui.mission.textContent = mission.active ? `Challenge: ${mission.hands} / 8 moves, ${mission.meetings} / 3 rendezvous` : `Challenge ${mission.result === "complete" ? "complete. Keepsake unlocked." : "ended. Journey points are kept."}`;
    }
    if (state.onboarding.enabled && state.onboarding.phase === "calibration") {
      ui.mission.hidden = false;
      ui.mission.textContent = `First-play calibration: ${state.onboarding.calibrationHands} / 8 moves, ${state.onboarding.calibrationMeetings} / 2 rendezvous`;
    } else if (state.onboarding.enabled && state.onboarding.phase === "complete" && state.onboarding.result) {
      ui.mission.hidden = false;
      ui.mission.textContent = state.onboarding.result === "understood" ? "First-play calibration complete." : "First-play calibration complete. Keep exploring.";
    }
    const tracing = state.status === "TRACING";
    ui.submitPath.disabled = !tracing || path.length<3;
    ui.cancelPath.disabled = !tracing;
    renderEffects(model, result);
    return model;
  }
  function applyPreferences({
    reducedMotion: nextReducedMotion
  }) {
    reducedMotion = Boolean(nextReducedMotion);
    body.classList.toggle("reduce-motion", reducedMotion);
    body.classList.toggle("low-end", lowEnd);
  }
  return Object.freeze({
    render, clearTransient, applyPreferences, lowEnd
  });
}
