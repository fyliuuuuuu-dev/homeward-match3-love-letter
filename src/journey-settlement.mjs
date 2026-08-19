const CHOICES = new Set(["continue", "store", "reopen"]);
const STYLE = `.journey-settlement{width:min(90vw,400px);padding:0;border:0;border-radius:18px;background:#fff8e8;color:#3f342a}.journey-settlement::backdrop{background:#2b262099}.journey-settlement-card{display:grid;gap:12px;padding:24px;text-align:center;border:2px solid #c7ad7b;border-radius:18px}.journey-settlement h2,.journey-settlement p{margin:0}.journey-settlement-kicker{color:#765d39;font-weight:750}.journey-settlement-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.journey-settlement-actions:has(:only-child){grid-template-columns:1fr}.journey-settlement button{background:#fffdf7}.journey-settlement button:first-child{border-color:#765d39;font-weight:750}`;

export function createJourneySettlementModel() {
  let active = null;
  return {
    show({ result, state }) {
      if (result?.arrival !== true || active || !Number.isInteger(state?.journey?.completed) || !Number.isInteger(state?.growth)) return false;
      active = { journeyCompleted: state.journey.completed, growth: state.growth, phase: "choice", recorded: new Set() };
      return true;
    },
    choose(choice) {
      if (!CHOICES.has(choice) || !active || active.recorded.has(choice)) return null;
      if ((choice === "reopen") !== (active.phase === "stored")) return null;
      active.recorded.add(choice);
      const payload = { choice, journeyCompleted: active.journeyCompleted, growth: active.growth };
      if (choice === "store") active.phase = "stored";
      else active = null;
      return payload;
    },
    snapshot: () => active && { journeyCompleted: active.journeyCompleted, growth: active.growth, phase: active.phase },
    reset: () => {
      active = null;
    }
  };
}

export function storedSettlementCopy({ journeyCompleted, growth }, saved) {
  if (saved) return {
    kicker: "This journey is tucked away",
    title: `Journey ${journeyCompleted} saved locally`,
    copy: `Total journey points: ${growth}. You may close this page or return for another route.`
  };
  return {
    kicker: "This journey is still open here",
    title: `Journey ${journeyCompleted} save did not complete`,
    copy: `Your ${growth} points remain in this open game. Download the session log or keep playing here.`
  };
}

export function createJourneySettlement({ document, onChoice }) {
  let dialog = null;
  const model = createJourneySettlementModel();

  function build() {
    if (dialog) return;
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);
    dialog = document.createElement("dialog");
    dialog.className = "journey-settlement";
    dialog.setAttribute("aria-labelledby", "journey-settlement-title");
    dialog.setAttribute("aria-describedby", "journey-settlement-copy");
    dialog.innerHTML = `<div class="journey-settlement-card"><p class="journey-settlement-kicker">The route made it home</p><h2 id="journey-settlement-title"></h2><p id="journey-settlement-copy"></p><div class="journey-settlement-actions"><button type="button" data-choice="continue">Start another journey</button><button type="button" data-choice="store">Save for today</button></div></div>`;
    dialog.addEventListener("cancel", (event) => event.preventDefault());
    dialog.addEventListener("click", (event) => {
      if(event.target.closest?.("[data-r]")){model.reset();dialog.close();return;}
      const choice = event.target.closest?.("[data-choice]")?.dataset.choice;
      const payload = model.choose(choice);
      if (!payload) return;
      const saved = onChoice(payload);
      if (choice === "store") renderStored(saved === true);
      else close();
    });
    document.body.append(dialog);
  }

  function renderStored(saved) {
    const active = model.snapshot();
    const content = storedSettlementCopy(active, saved);
    dialog.querySelector(".journey-settlement-kicker").textContent = content.kicker;
    dialog.querySelector("#journey-settlement-title").textContent = content.title;
    dialog.querySelector("#journey-settlement-copy").textContent = content.copy;
    dialog.querySelector(".journey-settlement-actions").innerHTML = `<button type="button" data-r>Close for now</button><button type="button" data-choice="reopen">Play another journey</button>`;
    dialog.querySelector("[data-choice=reopen]").focus();
  }

  function close() {
    dialog.close();
  }

  function show({ result, state }) {
    if (!model.show({ result, state })) return false;
    build();
    const active = model.snapshot();
    dialog.querySelector(".journey-settlement-kicker").textContent = "The route made it home";
    dialog.querySelector("#journey-settlement-title").textContent = `Journey ${active.journeyCompleted} complete`;
    dialog.querySelector("#journey-settlement-copy").textContent = `Total journey points: ${active.growth}. Continue, or save here for today?`;
    dialog.querySelector(".journey-settlement-actions").innerHTML = `<button type="button" data-choice="continue">Start another journey</button><button type="button" data-choice="store">Save for today</button>`;
    dialog.showModal();
    dialog.querySelector("[data-choice=continue]").focus();
    return true;
  }

  function reset() {
    if (dialog?.open) dialog.close();
    model.reset();
  }

  return {
    show,
    reset,
    isOpen: () => model.snapshot() !== null
  };
}
