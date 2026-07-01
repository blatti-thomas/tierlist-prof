// ============================================================
//  ÉDITEUR DE SON BOARD (accessible à tout le monde)
//  CRUD profs / branches / rangs + apparence
// ============================================================

import { getState, commitBoard, uid } from "./store.js?v=14";
import { escapeHtml, randomColor, icon } from "./util.js?v=14";
import { initThemeControls, renderThemeControls } from "./theme.js?v=14";
import { initCatalogAdmin, renderCatalogAdmin } from "./catalog.js?v=14";

export function initAdmin() {
  document.getElementById("openAdminBtn").onclick = openAdmin;
  document.getElementById("closeAdminBtn").onclick = closeAdmin;
  initThemeControls();
  initCatalogAdmin();
  initAccordion();

  document.getElementById("addProfBtn").onclick = () => {
    const name = document.getElementById("newProfName").value.trim();
    const branchId = document.getElementById("newProfBranch").value;
    if (!name) return;
    commitBoard(d => d.professors.push({ id: uid("p"), name, branchId }));
    document.getElementById("newProfName").value = "";
  };

  document.getElementById("addBranchBtn").onclick = () => {
    const name = document.getElementById("newBranchName").value.trim();
    if (!name) return;
    commitBoard(d => d.branches.push({ id: uid("b"), name }));
    document.getElementById("newBranchName").value = "";
  };

  document.getElementById("addRankBtn").onclick = () => {
    const label = document.getElementById("newRankLabel").value.trim();
    if (!label) return;
    commitBoard(d => d.ranks.push({ id: uid("r"), label, color: randomColor() }));
    document.getElementById("newRankLabel").value = "";
  };
}

// Sur mobile, chaque section (profs / cours / catégories / apparence) est un
// menu déroulant : on clique l'en-tête pour l'ouvrir/fermer (évite de scroller).
function initAccordion() {
  document.querySelectorAll("#adminModal .admin-col .acc-head").forEach(head => {
    head.addEventListener("click", () => {
      head.closest(".admin-col").classList.toggle("collapsed");
    });
  });
}

export function openAdmin() {
  document.getElementById("adminModal").classList.add("open");
  renderAdmin();
}
export function closeAdmin() {
  document.getElementById("adminModal").classList.remove("open");
}

export function renderAdmin() {
  const { board } = getState();
  if (!board) return;
  renderProfAdmin(board);
  renderBranchAdmin(board);
  renderRankAdmin(board);
  populateNewProfBranch(board);
  renderThemeControls(board);
  // Catalogue partagé (asynchrone : Firestore) — indépendant du board
  renderCatalogAdmin().catch(e => console.error("Catalogue :", e));
}

// ---------- Professeurs ----------
function renderProfAdmin(board) {
  const c = document.getElementById("adminProfs");
  c.innerHTML = "";

  board.professors.forEach(p => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = p.name;
    name.onchange = () => commitBoard(d => {
      const t = d.professors.find(x => x.id === p.id);
      if (t) t.name = name.value.trim();
    });

    const sel = document.createElement("select");
    sel.className = "ipt";
    sel.innerHTML = board.branches
      .map(b => `<option value="${b.id}" ${b.id === p.branchId ? "selected" : ""}>${escapeHtml(b.name)}</option>`)
      .join("");
    sel.onchange = () => commitBoard(d => {
      const t = d.professors.find(x => x.id === p.id);
      if (t) t.branchId = sel.value;
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.append(icon("delete"));
    del.onclick = () => commitBoard(d => {
      d.professors = d.professors.filter(x => x.id !== p.id);
    });

    row.append(name, sel, del);
    c.appendChild(row);
  });
}

// ---------- Branches (cours) ----------
function renderBranchAdmin(board) {
  const c = document.getElementById("adminBranches");
  c.innerHTML = "";

  board.branches.forEach(b => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = b.name;
    name.onchange = () => commitBoard(d => {
      const t = d.branches.find(x => x.id === b.id);
      if (t) t.name = name.value.trim();
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.append(icon("delete"));
    del.onclick = () => commitBoard(d => {
      d.branches = d.branches.filter(x => x.id !== b.id);
      d.professors.forEach(p => { if (p.branchId === b.id) p.branchId = ""; });
    });

    row.append(name, del);
    c.appendChild(row);
  });
}

// ---------- Rangs / catégories (label, couleur, ordre) ----------
function renderRankAdmin(board) {
  const c = document.getElementById("adminRanks");
  c.innerHTML = "";

  board.ranks.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const color = document.createElement("input");
    color.type = "color";
    color.className = "ipt-color";
    color.value = r.color;
    color.oninput = () => commitBoard(d => {
      const t = d.ranks.find(x => x.id === r.id);
      if (t) t.color = color.value;
    });

    const label = document.createElement("input");
    label.className = "ipt";
    label.value = r.label;
    label.onchange = () => commitBoard(d => {
      const t = d.ranks.find(x => x.id === r.id);
      if (t) t.label = label.value.trim();
    });

    const up = document.createElement("button");
    up.className = "btn btn-ghost btn-sm";
    up.append(icon("keyboard_arrow_up"));
    up.disabled = i === 0;
    up.onclick = () => commitBoard(d => {
      [d.ranks[i - 1], d.ranks[i]] = [d.ranks[i], d.ranks[i - 1]];
    });

    const down = document.createElement("button");
    down.className = "btn btn-ghost btn-sm";
    down.append(icon("keyboard_arrow_down"));
    down.disabled = i === board.ranks.length - 1;
    down.onclick = () => commitBoard(d => {
      [d.ranks[i + 1], d.ranks[i]] = [d.ranks[i], d.ranks[i + 1]];
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.append(icon("delete"));
    del.onclick = () => commitBoard(d => {
      d.ranks = d.ranks.filter(x => x.id !== r.id);
      if (d.tiers) delete d.tiers[r.id];
    });

    row.append(color, label, up, down, del);
    c.appendChild(row);
  });
}

function populateNewProfBranch(board) {
  const sel = document.getElementById("newProfBranch");
  sel.innerHTML = board.branches
    .map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");
}
