// ============================================================
//  PANNEAU D'ADMINISTRATION
//  CRUD : professeurs, branches, rangs (+ couleurs / ordre)
//  Chaque modification déclenche un commit() → sauvegarde auto.
// ============================================================

import { getState, commit, uid } from "./store.js";
import { escapeHtml, randomColor } from "./util.js";

export function initAdmin() {
  document.getElementById("openAdminBtn").onclick = openAdmin;
  document.getElementById("closeAdminBtn").onclick = closeAdmin;

  document.getElementById("addProfBtn").onclick = () => {
    const name = document.getElementById("newProfName").value.trim();
    const branchId = document.getElementById("newProfBranch").value;
    if (!name) return;
    commit(d => d.professors.push({ id: uid("p"), name, branchId }));
    document.getElementById("newProfName").value = "";
  };

  document.getElementById("addBranchBtn").onclick = () => {
    const name = document.getElementById("newBranchName").value.trim();
    if (!name) return;
    commit(d => d.branches.push({ id: uid("b"), name }));
    document.getElementById("newBranchName").value = "";
  };

  document.getElementById("addRankBtn").onclick = () => {
    const label = document.getElementById("newRankLabel").value.trim();
    if (!label) return;
    commit(d => d.ranks.push({ id: uid("r"), label, color: randomColor() }));
    document.getElementById("newRankLabel").value = "";
  };
}

export function openAdmin() {
  document.getElementById("adminModal").classList.add("open");
  renderAdmin();
}
export function closeAdmin() {
  document.getElementById("adminModal").classList.remove("open");
}

export function renderAdmin() {
  const state = getState();
  if (!state) return;
  renderProfAdmin(state);
  renderBranchAdmin(state);
  renderRankAdmin(state);
  populateNewProfBranch(state);
}

// ---------- Professeurs ----------
function renderProfAdmin(state) {
  const c = document.getElementById("adminProfs");
  c.innerHTML = "";

  state.professors.forEach(p => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = p.name;
    name.onchange = () => commit(d => {
      const t = d.professors.find(x => x.id === p.id);
      if (t) t.name = name.value.trim();
    });

    const sel = document.createElement("select");
    sel.className = "ipt";
    sel.innerHTML = state.branches
      .map(b => `<option value="${b.id}" ${b.id === p.branchId ? "selected" : ""}>${escapeHtml(b.name)}</option>`)
      .join("");
    sel.onchange = () => commit(d => {
      const t = d.professors.find(x => x.id === p.id);
      if (t) t.branchId = sel.value;
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.textContent = "✕";
    del.onclick = () => commit(d => {
      d.professors = d.professors.filter(x => x.id !== p.id);
      delete d.placements[p.id];
    });

    row.append(name, sel, del);
    c.appendChild(row);
  });
}

// ---------- Branches ----------
function renderBranchAdmin(state) {
  const c = document.getElementById("adminBranches");
  c.innerHTML = "";

  state.branches.forEach(b => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = b.name;
    name.onchange = () => commit(d => {
      const t = d.branches.find(x => x.id === b.id);
      if (t) t.name = name.value.trim();
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.textContent = "✕";
    del.onclick = () => commit(d => {
      d.branches = d.branches.filter(x => x.id !== b.id);
      d.professors.forEach(p => { if (p.branchId === b.id) p.branchId = ""; });
    });

    row.append(name, del);
    c.appendChild(row);
  });
}

// ---------- Rangs (label, couleur, ordre) ----------
function renderRankAdmin(state) {
  const c = document.getElementById("adminRanks");
  c.innerHTML = "";

  state.ranks.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const color = document.createElement("input");
    color.type = "color";
    color.className = "ipt-color";
    color.value = r.color;
    color.oninput = () => commit(d => {
      const t = d.ranks.find(x => x.id === r.id);
      if (t) t.color = color.value;
    });

    const label = document.createElement("input");
    label.className = "ipt";
    label.value = r.label;
    label.onchange = () => commit(d => {
      const t = d.ranks.find(x => x.id === r.id);
      if (t) t.label = label.value.trim();
    });

    const up = document.createElement("button");
    up.className = "btn btn-ghost btn-sm";
    up.textContent = "▲";
    up.disabled = i === 0;
    up.onclick = () => commit(d => {
      [d.ranks[i - 1], d.ranks[i]] = [d.ranks[i], d.ranks[i - 1]];
    });

    const down = document.createElement("button");
    down.className = "btn btn-ghost btn-sm";
    down.textContent = "▼";
    down.disabled = i === state.ranks.length - 1;
    down.onclick = () => commit(d => {
      [d.ranks[i + 1], d.ranks[i]] = [d.ranks[i], d.ranks[i + 1]];
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.textContent = "✕";
    del.onclick = () => commit(d => {
      d.ranks = d.ranks.filter(x => x.id !== r.id);
      Object.keys(d.placements).forEach(pid => {
        if (d.placements[pid] === r.id) delete d.placements[pid];
      });
    });

    row.append(color, label, up, down, del);
    c.appendChild(row);
  });
}

function populateNewProfBranch(state) {
  const sel = document.getElementById("newProfBranch");
  sel.innerHTML = state.branches
    .map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");
}
