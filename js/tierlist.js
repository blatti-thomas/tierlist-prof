// ============================================================
//  TIER LIST — Rendu ordonné + Glisser/Déposer (PC + tactile)
//  Lit la config partagée + le classement perso ordonné (tiers).
// ============================================================

import { getState, moveProf } from "./store.js?v=15";
import { escapeHtml } from "./util.js?v=15";

const BANK_ZONE = "__bank__";

// ------------------------------------------------------------
//  RENDU PRINCIPAL
// ------------------------------------------------------------
export function renderApp() {
  const { board, error } = getState();
  const wrap = document.getElementById("tierRows");
  if (error) {
    wrap.innerHTML = `<p class="login-error">⚠️ ${escapeHtml(error)}</p>`;
    document.getElementById("bank").innerHTML = "";
    return;
  }
  if (!board) {
    wrap.innerHTML = `<p class="hint">⏳ Chargement de ta tier list…</p>`;
    document.getElementById("bank").innerHTML = "";
    return;
  }
  renderTiers();
  renderBank();
}

function profById(id) {
  return getState().board.professors.find(p => p.id === id);
}

function renderTiers() {
  const { board } = getState();
  const tiers = board.tiers;
  const wrap = document.getElementById("tierRows");
  wrap.innerHTML = "";

  board.ranks.forEach(rank => {
    const row = document.createElement("div");
    row.className = "tier-row";

    const label = document.createElement("div");
    label.className = "tier-label";
    label.style.background = rank.color;
    label.textContent = rank.label;

    const zone = document.createElement("div");
    zone.className = "tier-zone dropzone";
    zone.dataset.drop = rank.id;

    (tiers[rank.id] || []).forEach(profId => {
      const p = profById(profId);
      if (p) zone.appendChild(makeChip(p));
    });

    row.append(label, zone);
    wrap.appendChild(row);
  });
}

function renderBank() {
  const { board } = getState();
  const bank = document.getElementById("bank");
  bank.innerHTML = "";
  bank.classList.add("dropzone");
  bank.dataset.drop = BANK_ZONE;

  // profs présents dans aucun rang
  const placed = new Set(Object.values(board.tiers).flat());
  const list = board.professors.filter(p => !placed.has(p.id));

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "bank-empty";
    empty.textContent = "Tous les profs sont classés.";
    bank.appendChild(empty);
  } else {
    list.forEach(p => bank.appendChild(makeChip(p)));
  }
}

function makeChip(p) {
  const { board } = getState();
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.dataset.prof = p.id;

  const branch = board.branches.find(b => b.id === p.branchId);
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

// --- Défilement automatique quand le doigt s'approche d'un bord de l'écran ---
// (indispensable sur mobile : on ne peut pas scroller la page en draggant,
//  donc on fait défiler tout seul pour atteindre les rangs en haut.)
const EDGE = 90;        // hauteur de la zone (en px) qui déclenche le défilement
const MAX_SPEED = 16;   // vitesse max (px par frame)
let lastPointer = { x: 0, y: 0 };
let autoScrollRAF = null;

function startAutoScroll() {
  if (autoScrollRAF) return;
  const step = () => {
    if (!drag || !drag.active) { autoScrollRAF = null; return; }
    const { y, x } = lastPointer;
    const h = window.innerHeight;
    // En haut, le menu jaune (sticky) recouvre le contenu : on déclenche le
    // défilement dès que le doigt atteint le bord inférieur du menu, pas le
    // bord de l'écran (sinon on ne peut pas viser les rangs cachés dessous).
    const topbar = document.querySelector(".topbar");
    const topEdge = topbar ? topbar.getBoundingClientRect().bottom : 0;
    let dy = 0;
    if (y < topEdge + EDGE)  dy = -MAX_SPEED * Math.min(1, (topEdge + EDGE - y) / EDGE);
    else if (y > h - EDGE)   dy =  MAX_SPEED * Math.min(1, (y - (h - EDGE)) / EDGE);
    if (dy !== 0) {
      window.scrollBy(0, dy);
      highlightZone(x, y);   // la zone sous le doigt change pendant le défilement
    }
    autoScrollRAF = requestAnimationFrame(step);
  };
  autoScrollRAF = requestAnimationFrame(step);
}

function stopAutoScroll() {
  if (autoScrollRAF) cancelAnimationFrame(autoScrollRAF);
  autoScrollRAF = null;
}

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
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
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
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  startAutoScroll();
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

// Position d'insertion dans une zone, selon la position du pointeur
function insertIndexAt(zone, x, y) {
  const chips = [...zone.querySelectorAll(".chip")].filter(c => !c.classList.contains("chip-dragging"));
  for (let i = 0; i < chips.length; i++) {
    const r = chips[i].getBoundingClientRect();
    if (y < r.top) return i;                              // pointeur au-dessus de cette ligne
    if (y <= r.bottom && x < r.left + r.width / 2) return i; // avant ce prof dans sa ligne
  }
  return chips.length;
}

function onUp(e) {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onUp);
  stopAutoScroll();
  if (!drag) return;

  const d = drag;
  drag = null;
  document.querySelectorAll(".drop-hover").forEach(z => z.classList.remove("drop-hover"));
  if (!d.active) return;

  const zone = zoneAt(e.clientX, e.clientY);
  if (d.ghost) d.ghost.remove();

  if (zone) {
    const target = zone.dataset.drop;
    if (target === BANK_ZONE) {
      moveProf(d.profId, null);
    } else {
      const index = insertIndexAt(zone, e.clientX, e.clientY);
      moveProf(d.profId, target, index);
    }
  } else {
    d.chip.classList.remove("chip-dragging");
  }
}
