// ============================================================
//  STATISTIQUES — profs les mieux classés (toutes tier lists)
//  Score normalisé : indépendant du nombre de catégories.
//  Pour un board à N rangs, le rang i (0 = tout en haut) vaut
//  (N-1-i)/(N-1) → haut = 1, bas = 0. Moyenne sur tous les boards.
// ============================================================

import { loadAllBoards } from "./store.js?v=6";
import { escapeHtml } from "./util.js?v=6";

export function initStats() {
  document.getElementById("openStatsBtn").onclick = openStats;
  document.getElementById("closeStatsBtn").onclick = () =>
    document.getElementById("statsModal").classList.remove("open");
}

async function openStats() {
  const modal = document.getElementById("statsModal");
  const box = document.getElementById("statsContent");
  modal.classList.add("open");
  box.innerHTML = `<p class="hint">Calcul des statistiques…</p>`;
  try {
    const boards = await loadAllBoards();
    renderStats(computeStats(boards));
  } catch (e) {
    box.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function computeStats(boards) {
  const agg = new Map(); // nom -> { sum, count }

  boards.forEach(b => {
    const ranks = b.ranks || [];
    const profs = b.professors || [];
    const tiers = b.tiers || {};
    const n = ranks.length;

    ranks.forEach((rank, i) => {
      const score = n <= 1 ? 1 : (n - 1 - i) / (n - 1);
      (tiers[rank.id] || []).forEach(pid => {
        const p = profs.find(x => x.id === pid);
        if (!p || !p.name) return;
        const key = p.name.trim();
        const cur = agg.get(key) || { sum: 0, count: 0 };
        cur.sum += score;
        cur.count += 1;
        agg.set(key, cur);
      });
    });
  });

  return [...agg.entries()]
    .map(([name, v]) => ({ name, avg: v.sum / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count);
}

function renderStats(list) {
  const box = document.getElementById("statsContent");
  box.innerHTML = "";

  if (!list.length) {
    box.innerHTML = `<p class="hint">Aucun prof classé pour l'instant.</p>`;
    return;
  }

  list.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "stat-row";

    const pos = document.createElement("div");
    pos.className = "stat-pos";
    if (i === 0) {
      pos.innerHTML = `<span class="material-symbols-rounded gold">trophy</span>`;
    } else if (i < 3) {
      pos.innerHTML = `<span class="material-symbols-rounded ${i === 1 ? "silver" : "bronze"}">workspace_premium</span>`;
    } else {
      pos.textContent = (i + 1);
    }

    const main = document.createElement("div");
    main.className = "stat-main";
    const pct = Math.round(s.avg * 100);
    main.innerHTML =
      `<div class="stat-name">${escapeHtml(s.name)}</div>` +
      `<div class="stat-bar"><span style="width:${pct}%"></span></div>` +
      `<div class="stat-meta">${pct}% · classé par ${s.count} personne${s.count > 1 ? "s" : ""}</div>`;

    row.append(pos, main);
    box.appendChild(row);
  });
}
