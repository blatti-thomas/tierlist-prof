// ============================================================
//  PANNEAU D'ADMINISTRATION (admin uniquement)
//  CRUD profs / branches / rangs + apparence + classements
// ============================================================

import { getState, commitConfig, uid, loadAllRankings, tiersFromPlacements } from "./store.js";
import { escapeHtml, randomColor } from "./util.js";
import { initThemeControls, renderThemeControls } from "./theme.js";

export function initAdmin() {
  document.getElementById("openAdminBtn").onclick = openAdmin;
  document.getElementById("closeAdminBtn").onclick = closeAdmin;
  initThemeControls();

  document.getElementById("addProfBtn").onclick = () => {
    const name = document.getElementById("newProfName").value.trim();
    const branchId = document.getElementById("newProfBranch").value;
    if (!name) return;
    commitConfig(d => d.professors.push({ id: uid("p"), name, branchId }));
    document.getElementById("newProfName").value = "";
  };

  document.getElementById("addBranchBtn").onclick = () => {
    const name = document.getElementById("newBranchName").value.trim();
    if (!name) return;
    commitConfig(d => d.branches.push({ id: uid("b"), name }));
    document.getElementById("newBranchName").value = "";
  };

  document.getElementById("addRankBtn").onclick = () => {
    const label = document.getElementById("newRankLabel").value.trim();
    if (!label) return;
    commitConfig(d => d.ranks.push({ id: uid("r"), label, color: randomColor() }));
    document.getElementById("newRankLabel").value = "";
  };

  document.getElementById("loadRankingsBtn").onclick = async () => {
    const box = document.getElementById("adminRankings");
    box.innerHTML = `<p class="hint">Chargement…</p>`;
    try {
      const list = await loadAllRankings();
      renderAllRankings(list);
    } catch (e) {
      box.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
    }
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
  const { config } = getState();
  if (!config) return;
  renderProfAdmin(config);
  renderBranchAdmin(config);
  renderRankAdmin(config);
  populateNewProfBranch(config);
  renderThemeControls(config);
}

// ---------- Professeurs ----------
function renderProfAdmin(config) {
  const c = document.getElementById("adminProfs");
  c.innerHTML = "";

  config.professors.forEach(p => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = p.name;
    name.onchange = () => commitConfig(d => {
      const t = d.professors.find(x => x.id === p.id);
      if (t) t.name = name.value.trim();
    });

    const sel = document.createElement("select");
    sel.className = "ipt";
    sel.innerHTML = config.branches
      .map(b => `<option value="${b.id}" ${b.id === p.branchId ? "selected" : ""}>${escapeHtml(b.name)}</option>`)
      .join("");
    sel.onchange = () => commitConfig(d => {
      const t = d.professors.find(x => x.id === p.id);
      if (t) t.branchId = sel.value;
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.textContent = "✕";
    del.onclick = () => commitConfig(d => {
      d.professors = d.professors.filter(x => x.id !== p.id);
    });

    row.append(name, sel, del);
    c.appendChild(row);
  });
}

// ---------- Branches ----------
function renderBranchAdmin(config) {
  const c = document.getElementById("adminBranches");
  c.innerHTML = "";

  config.branches.forEach(b => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = b.name;
    name.onchange = () => commitConfig(d => {
      const t = d.branches.find(x => x.id === b.id);
      if (t) t.name = name.value.trim();
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.textContent = "✕";
    del.onclick = () => commitConfig(d => {
      d.branches = d.branches.filter(x => x.id !== b.id);
      d.professors.forEach(p => { if (p.branchId === b.id) p.branchId = ""; });
    });

    row.append(name, del);
    c.appendChild(row);
  });
}

// ---------- Rangs (label, couleur, ordre) ----------
function renderRankAdmin(config) {
  const c = document.getElementById("adminRanks");
  c.innerHTML = "";

  config.ranks.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const color = document.createElement("input");
    color.type = "color";
    color.className = "ipt-color";
    color.value = r.color;
    color.oninput = () => commitConfig(d => {
      const t = d.ranks.find(x => x.id === r.id);
      if (t) t.color = color.value;
    });

    const label = document.createElement("input");
    label.className = "ipt";
    label.value = r.label;
    label.onchange = () => commitConfig(d => {
      const t = d.ranks.find(x => x.id === r.id);
      if (t) t.label = label.value.trim();
    });

    const up = document.createElement("button");
    up.className = "btn btn-ghost btn-sm";
    up.textContent = "▲";
    up.disabled = i === 0;
    up.onclick = () => commitConfig(d => {
      [d.ranks[i - 1], d.ranks[i]] = [d.ranks[i], d.ranks[i - 1]];
    });

    const down = document.createElement("button");
    down.className = "btn btn-ghost btn-sm";
    down.textContent = "▼";
    down.disabled = i === config.ranks.length - 1;
    down.onclick = () => commitConfig(d => {
      [d.ranks[i + 1], d.ranks[i]] = [d.ranks[i], d.ranks[i + 1]];
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.textContent = "✕";
    del.onclick = () => commitConfig(d => {
      d.ranks = d.ranks.filter(x => x.id !== r.id);
    });

    row.append(color, label, up, down, del);
    c.appendChild(row);
  });
}

function populateNewProfBranch(config) {
  const sel = document.getElementById("newProfBranch");
  sel.innerHTML = config.branches
    .map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`)
    .join("");
}

// ---------- Classements de tous les utilisateurs ----------
function renderAllRankings(list) {
  const { config } = getState();
  const box = document.getElementById("adminRankings");
  box.innerHTML = "";

  if (!list.length) {
    box.innerHTML = `<p class="hint">Aucun classement pour l'instant.</p>`;
    return;
  }

  list.forEach(u => {
    const card = document.createElement("div");
    card.className = "ranking-card";

    const title = document.createElement("h4");
    title.textContent = u.displayName || u.uid;
    card.appendChild(title);

    const tiers = u.tiers || tiersFromPlacements(u.placements);

    config.ranks.forEach(rank => {
      const profs = (tiers[rank.id] || [])
        .map(id => config.professors.find(p => p.id === id))
        .filter(Boolean)
        .map(p => p.name);

      const row = document.createElement("div");
      row.className = "ranking-row";

      const lab = document.createElement("span");
      lab.className = "ranking-label";
      lab.style.background = rank.color;
      lab.textContent = rank.label;

      const names = document.createElement("span");
      names.className = "ranking-names";
      names.textContent = profs.length ? profs.join(", ") : "—";

      row.append(lab, names);
      card.appendChild(row);
    });

    box.appendChild(card);
  });
}
