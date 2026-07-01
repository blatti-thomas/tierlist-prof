// ============================================================
//  PROPOSITIONS — découvrir et importer ce que les autres ont
//  ajouté (profs, cours, catégories) sans les doublons.
//  Modèle "découvrir & importer" : on lit tous les boards et on
//  propose ce qui manque dans le tien ; tu acceptes en 1 clic.
// ============================================================

import { getState, commitBoard, loadAllBoards, uid } from "./store.js?v=14";
import { escapeHtml, icon } from "./util.js?v=14";

let lastBoards = [];

const norm = (s) => (s || "").trim().toLowerCase();

// Catégories universelles présentes partout : on ne les propose jamais.
const DEFAULT_RANK_LABELS = new Set(["s", "a", "b", "c", "d"]);

export function initSuggestions() {
  document.getElementById("openPropsBtn").onclick = openProps;
  document.getElementById("closePropsBtn").onclick = () =>
    document.getElementById("propsModal").classList.remove("open");
}

async function openProps() {
  const modal = document.getElementById("propsModal");
  modal.classList.add("open");
  ["propProfs", "propBranches", "propRanks"].forEach(id =>
    document.getElementById(id).innerHTML = `<p class="hint">Chargement…</p>`);
  try {
    lastBoards = await loadAllBoards();
    render();
  } catch (e) {
    document.getElementById("propProfs").innerHTML =
      `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function render() {
  const { board, uid: myUid } = getState();
  if (!board) return;

  const myProfs    = new Set(board.professors.map(p => norm(p.name)));
  const myBranches = new Set(board.branches.map(b => norm(b.name)));
  const myRanks    = new Set(board.ranks.map(r => norm(r.label)));

  const profMap = new Map();   // -> { name, branchName, by:Set }
  const branchMap = new Map(); // -> { name, by:Set }
  const rankMap = new Map();   // -> { label, color, by:Set }

  lastBoards.forEach(bd => {
    if (bd.uid === myUid) return;                 // pas mes propres ajouts
    const who = bd.displayName || "Quelqu'un";
    const branches = bd.branches || [];

    (bd.professors || []).forEach(p => {
      const k = norm(p.name);
      if (!p.name || myProfs.has(k)) return;
      const br = branches.find(b => b.id === p.branchId);
      const cur = profMap.get(k) || { name: p.name.trim(), branchName: br ? br.name : "", by: new Set() };
      cur.by.add(who);
      profMap.set(k, cur);
    });

    branches.forEach(b => {
      const k = norm(b.name);
      if (!b.name || myBranches.has(k)) return;
      const cur = branchMap.get(k) || { name: b.name.trim(), by: new Set() };
      cur.by.add(who);
      branchMap.set(k, cur);
    });

    (bd.ranks || []).forEach(r => {
      const k = norm(r.label);
      if (!r.label || myRanks.has(k) || DEFAULT_RANK_LABELS.has(k)) return;
      const cur = rankMap.get(k) || { label: r.label.trim(), color: r.color || "#cccccc", by: new Set() };
      cur.by.add(who);
      rankMap.set(k, cur);
    });
  });

  renderSection("propProfs",   [...profMap.values()],   "prof");
  renderSection("propBranches", [...branchMap.values()], "branch");
  renderSection("propRanks",   [...rankMap.values()],   "rank");
}

function renderSection(containerId, items, type) {
  const c = document.getElementById(containerId);
  c.innerHTML = "";

  if (!items.length) {
    c.innerHTML = `<p class="hint">Rien de nouveau ici.</p>`;
    return;
  }

  items.sort((a, b) => b.by.size - a.by.size);

  const addAll = document.createElement("button");
  addAll.className = "btn btn-accent btn-sm";
  addAll.append(icon("done_all"));
  addAll.append(document.createTextNode(" Tout ajouter"));
  addAll.onclick = () => { items.forEach(it => addItem(type, it)); render(); };
  c.appendChild(addAll);

  items.forEach(it => {
    const row = document.createElement("div");
    row.className = "prop-item";

    const info = document.createElement("div");
    info.className = "prop-info";

    const nameLine = document.createElement("div");
    nameLine.className = "prop-name";
    if (type === "rank") {
      const sw = document.createElement("span");
      sw.className = "prop-swatch";
      sw.style.background = it.color;
      nameLine.appendChild(sw);
    }
    const label = type === "rank" ? it.label : it.name;
    const sub = (type === "prof" && it.branchName) ? "  ·  " + it.branchName : "";
    nameLine.appendChild(document.createTextNode(label + sub));

    const by = document.createElement("div");
    by.className = "prop-by";
    const who = [...it.by];
    by.textContent = "Proposé par " +
      (who.length <= 2 ? who.join(", ") : who.slice(0, 2).join(", ") + " (+" + (who.length - 2) + ")");
    by.title = "Proposé par " + who.join(", ");   // liste complète au survol

    info.append(nameLine, by);

    const add = document.createElement("button");
    add.className = "btn btn-primary btn-sm prop-add";
    add.append(icon("add"));
    add.append(document.createTextNode(" Ajouter"));
    add.onclick = () => { addItem(type, it); render(); };

    row.append(info, add);
    c.appendChild(row);
  });
}


function addItem(type, it) {
  if (type === "prof") {
    commitBoard(d => {
      if (d.professors.some(p => norm(p.name) === norm(it.name))) return; // anti-doublon
      let branchId = "";
      if (it.branchName) {
        let br = d.branches.find(b => norm(b.name) === norm(it.branchName));
        if (!br) { br = { id: uid("b"), name: it.branchName }; d.branches.push(br); }
        branchId = br.id;
      }
      d.professors.push({ id: uid("p"), name: it.name, branchId });
    });
  } else if (type === "branch") {
    commitBoard(d => {
      if (!d.branches.some(b => norm(b.name) === norm(it.name)))
        d.branches.push({ id: uid("b"), name: it.name });
    });
  } else if (type === "rank") {
    commitBoard(d => {
      if (!d.ranks.some(r => norm(r.label) === norm(it.label)))
        d.ranks.push({ id: uid("r"), label: it.label, color: it.color });
    });
  }
}
