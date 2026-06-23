// ============================================================
//  TIER LIST — Rendu + Glisser/Déposer (PC + tactile)
//  Lit la config partagée et écrit dans le classement perso.
// ============================================================

import { getState, setPlacement } from "./store.js";
import { escapeHtml } from "./util.js";

const BANK_ZONE = "__bank__";
let bankFilter = "__all__";

// ------------------------------------------------------------
//  RENDU PRINCIPAL
// ------------------------------------------------------------
export function renderApp() {
  const { config, error } = getState();
  const wrap = document.getElementById("tierRows");
  if (error) {
    wrap.innerHTML = `<p class="login-error">⚠️ ${escapeHtml(error)}</p>`;
    document.getElementById("bank").innerHTML = "";
    return;
  }
  if (!config) {
    wrap.innerHTML = `<p class="hint">⏳ En attente de la configuration par l'administrateur…</p>`;
    document.getElementById("bank").innerHTML = "";
    return;
  }
  renderTiers();
  renderBankFilter();
  renderBank();
}

function renderTiers() {
  const { config, placements } = getState();
  const wrap = document.getElementById("tierRows");
  wrap.innerHTML = "";

  config.ranks.forEach(rank => {
    const row = document.createElement("div");
    row.className = "tier-row";

    const label = document.createElement("div");
    label.className = "tier-label";
    label.style.background = rank.color;
    label.textContent = rank.label;

    const zone = document.createElement("div");
    zone.className = "tier-zone dropzone";
    zone.dataset.drop = rank.id;

    config.professors
      .filter(p => placements[p.id] === rank.id)
      .forEach(p => zone.appendChild(makeChip(p)));

    row.append(label, zone);
    wrap.appendChild(row);
  });
}

function renderBank() {
  const { config, placements } = getState();
  const bank = document.getElementById("bank");
  bank.innerHTML = "";
  bank.classList.add("dropzone");
  bank.dataset.drop = BANK_ZONE;

  const list = config.professors.filter(p =>
    !placements[p.id] &&
    (bankFilter === "__all__" || p.branchId === bankFilter)
  );

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "bank-empty";
    empty.textContent = "Aucun prof ici 🎉";
    bank.appendChild(empty);
  } else {
    list.forEach(p => bank.appendChild(makeChip(p)));
  }
}

function renderBankFilter() {
  const { config } = getState();
  const sel = document.getElementById("bankFilter");
  const current = bankFilter;
  sel.innerHTML =
    `<option value="__all__">Toutes les branches</option>` +
    config.branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");

  bankFilter = (current === "__all__" || config.branches.some(b => b.id === current))
    ? current : "__all__";
  sel.value = bankFilter;

  sel.onchange = () => { bankFilter = sel.value; renderBank(); };
}

function makeChip(p) {
  const { config } = getState();
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.dataset.prof = p.id;

  const branch = config.branches.find(b => b.id === p.branchId);
  chip.innerHTML =
    `<span class="chip-name">${escapeHtml(p.name)}</span>` +
    (branch ? `<span class="chip-branch">${escapeHtml(branch.name)}</span>` : "");

  chip.addEventListener("pointerdown", (e) => startDrag(e, p.id));
  return chip;
}

// ============================================================
//  GLISSER / DÉPOSER (pointer events → souris ET doigt)
// ============================================================
let drag = null;
const THRESHOLD = 6;

function startDrag(e, profId) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  drag = {
    profId, chip: e.currentTarget, ghost: null, active: false,
    startX: e.clientX, startY: e.clientY, offsetX: 0, offsetY: 0
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  e.preventDefault();
}

function onMove(e) {
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < THRESHOLD) return;
    beginGhost(e);
  }
  drag.ghost.style.left = (e.clientX - drag.offsetX) + "px";
  drag.ghost.style.top  = (e.clientY - drag.offsetY) + "px";
  highlightZone(e.clientX, e.clientY);
}

function beginGhost(e) {
  drag.active = true;
  const rect = drag.chip.getBoundingClientRect();
  drag.offsetX = e.clientX - rect.left;
  drag.offsetY = e.clientY - rect.top;

  const ghost = drag.chip.cloneNode(true);
  ghost.classList.add("chip-ghost");
  ghost.style.width = rect.width + "px";
  ghost.style.left = rect.left + "px";
  ghost.style.top = rect.top + "px";
  document.body.appendChild(ghost);

  drag.ghost = ghost;
  drag.chip.classList.add("chip-dragging");
}

function zoneAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".dropzone") : null;
}

function highlightZone(x, y) {
  document.querySelectorAll(".drop-hover").forEach(z => z.classList.remove("drop-hover"));
  const zone = zoneAt(x, y);
  if (zone) zone.classList.add("drop-hover");
}

function onUp(e) {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onUp);
  if (!drag) return;

  const d = drag;
  drag = null;
  document.querySelectorAll(".drop-hover").forEach(z => z.classList.remove("drop-hover"));
  if (!d.active) return;

  const zone = zoneAt(e.clientX, e.clientY);
  if (d.ghost) d.ghost.remove();

  if (zone) {
    const target = zone.dataset.drop;
    setPlacement(d.profId, target === BANK_ZONE ? null : target);
  } else {
    d.chip.classList.remove("chip-dragging");
  }
}
