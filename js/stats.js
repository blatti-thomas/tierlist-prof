// ============================================================
//  STATISTIQUES — profs les mieux classés (toutes tier lists)
//  Score normalisé : indépendant du nombre de catégories.
//  Pour un board à N rangs, le rang i (0 = tout en haut) vaut
//  (N-1-i)/(N-1) → haut = 1, bas = 0. Moyenne sur tous les boards.
//
//  En plus du classement, on dessine des graphes (Chart.js) :
//   • barres   — nombre de votes par prof
//   • camembert — répartition des votes
//   • toile d'araignée — comparaison du top
//   • nuage 2D — popularité (votes) vs note (score)
// ============================================================

import { loadAllBoards } from "./store.js?v=6";
import { escapeHtml } from "./util.js?v=6";

// Instances Chart.js en cours, à détruire avant un nouveau rendu
let charts = [];
// Dernier classement calculé (réutilisé entre onglets) + état du rendu des graphes
let currentList = [];
let chartsRendered = false;

export function initStats() {
  document.getElementById("openStatsBtn").onclick = openStats;
  document.getElementById("closeStatsBtn").onclick = () =>
    document.getElementById("statsModal").classList.remove("open");
  initTabs();
}

// ---- Onglets (évitent de devoir scroller : podium / classement / graphiques) ----
function initTabs() {
  document.querySelectorAll("#statsTabs .tab").forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
}

function activateTab(name) {
  document.querySelectorAll("#statsTabs .tab").forEach(b =>
    b.classList.toggle("tab-active", b.dataset.tab === name));
  document.querySelectorAll("#statsModal .tab-panel").forEach(p =>
    p.classList.toggle("tab-panel-active", p.dataset.panel === name));

  // Les graphes ne se dimensionnent correctement qu'une fois le panneau visible :
  // on les rend à la première ouverture de l'onglet « Graphiques ».
  if (name === "graphes" && !chartsRendered) {
    renderCharts(currentList);
    chartsRendered = true;
  }
}

async function openStats() {
  const modal = document.getElementById("statsModal");
  const box = document.getElementById("statsContent");
  modal.classList.add("open");
  activateTab("podium");
  box.innerHTML = `<p class="hint">Calcul des statistiques…</p>`;
  document.getElementById("podium").innerHTML = `<p class="hint">Calcul des statistiques…</p>`;
  document.getElementById("podiumDetail").innerHTML = "";
  chartsRendered = false;
  destroyCharts();
  try {
    const boards = await loadAllBoards();
    currentList = computeStats(boards);
    renderPodium(currentList);
    renderStats(currentList);
  } catch (e) {
    box.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
    document.getElementById("podium").innerHTML = "";
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

  const entries = [...agg.entries()]
    .map(([name, v]) => ({ name, sum: v.sum, avg: v.sum / v.count, count: v.count }));
  if (!entries.length) return [];

  // --- Moyenne pondérée bayésienne (corrige le biais du petit échantillon) ---
  // score = (somme_des_scores + C * moyenne_globale) / (nb_classements + C)
  // Plus un prof est classé par peu de monde, plus son score est tiré vers la
  // moyenne générale. C = nombre moyen de classements par prof (confiance).
  const totalCount = entries.reduce((a, e) => a + e.count, 0);
  const totalSum   = entries.reduce((a, e) => a + e.sum, 0);
  const globalMean = totalSum / totalCount;
  const C = Math.max(1, totalCount / entries.length);

  entries.forEach(e => {
    e.score = (e.sum + C * globalMean) / (e.count + C);
  });

  return entries.sort((a, b) => b.score - a.score || b.count - a.count);
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
    const pct = Math.round(s.score * 100);
    const raw = Math.round(s.avg * 100);
    main.innerHTML =
      `<div class="stat-name">${escapeHtml(s.name)}</div>` +
      `<div class="stat-bar"><span style="width:${pct}%"></span></div>` +
      `<div class="stat-meta">${pct}% pondéré · ${raw}% brut · classé par ${s.count} personne${s.count > 1 ? "s" : ""}</div>`;

    row.append(pos, main);
    box.appendChild(row);
  });
}

// ============================================================
//  PODIUM (top 3) — cliquable pour voir le détail
// ============================================================

const MEDAL = ["gold", "silver", "bronze"];

function renderPodium(list) {
  const box = document.getElementById("podium");
  const detail = document.getElementById("podiumDetail");
  box.innerHTML = "";
  detail.innerHTML = "";

  if (!list.length) {
    box.innerHTML = `<p class="hint">Aucun prof classé pour l'instant.</p>`;
    return;
  }

  const top = list.slice(0, 3);
  // Ordre d'affichage : 2e à gauche, 1er au centre (plus haut), 3e à droite
  const order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];

  order.forEach(idx => {
    const s = top[idx];
    const card = document.createElement("button");
    card.className = `podium-spot podium-${idx + 1}`;
    card.type = "button";
    const pct = Math.round(s.score * 100);
    card.innerHTML =
      `<span class="material-symbols-rounded podium-medal ${MEDAL[idx]}">${idx === 0 ? "trophy" : "workspace_premium"}</span>` +
      `<span class="podium-rank">${idx + 1}</span>` +
      `<span class="podium-name">${escapeHtml(s.name)}</span>` +
      `<span class="podium-score">${pct}%</span>`;
    card.onclick = () => showDetail(list, idx);
    box.appendChild(card);
  });

  // Détail du 1er affiché par défaut
  showDetail(list, 0);
}

function showDetail(list, idx) {
  const detail = document.getElementById("podiumDetail");
  const s = list[idx];
  if (!s) { detail.innerHTML = ""; return; }
  const pct = Math.round(s.score * 100);
  const raw = Math.round(s.avg * 100);
  detail.innerHTML =
    `<div class="detail-head">` +
      `<span class="material-symbols-rounded ${idx < 3 ? MEDAL[idx] : ""}">${idx === 0 ? "trophy" : idx < 3 ? "workspace_premium" : "person"}</span>` +
      `<span class="detail-name">${escapeHtml(s.name)}</span>` +
      `<span class="detail-pos">#${idx + 1}</span>` +
    `</div>` +
    `<div class="stat-bar"><span style="width:${pct}%"></span></div>` +
    `<div class="detail-grid">` +
      `<div class="detail-cell"><span class="detail-num">${pct}%</span><span class="detail-lbl">score pondéré</span></div>` +
      `<div class="detail-cell"><span class="detail-num">${raw}%</span><span class="detail-lbl">score brut</span></div>` +
      `<div class="detail-cell"><span class="detail-num">${s.count}</span><span class="detail-lbl">classé par ${s.count > 1 ? "personnes" : "personne"}</span></div>` +
    `</div>`;
}

// ============================================================
//  GRAPHES (Chart.js)
// ============================================================

// Palette « cartoon » réutilisée pour les camemberts / barres
const PALETTE = [
  "#ff5d8f", "#4ab8ff", "#ffd84a", "#7ed957", "#b06bff",
  "#ff8a4a", "#ff5d5d", "#41d6c3", "#ffba08", "#9aa0ff"
];

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function destroyCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
}

function renderCharts(list) {
  const wrap = document.getElementById("statsCharts");
  if (!wrap) return;

  // Chart.js indisponible (CDN bloqué / hors-ligne) → on masque la zone
  if (typeof window.Chart === "undefined") {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = list.length ? "" : "none";
  // Réaffiche toutes les cartes (certaines ont pu être masquées au rendu précédent)
  wrap.querySelectorAll(".stats-chart-card").forEach(c => { c.style.display = ""; });
  destroyCharts();
  if (!list.length) return;

  const Chart = window.Chart;
  Chart.defaults.font.family = cssVar("--font", "Fredoka, sans-serif");
  Chart.defaults.color = cssVar("--text", "#15151e");
  const ink = cssVar("--ink", "#15151e");
  const primary = cssVar("--primary", "#ff5d8f");
  const accent  = cssVar("--accent", "#4ab8ff");

  // --- 1) Barres : nombre de votes par prof (les plus votés) ---
  const byVotes = [...list].sort((a, b) => b.count - a.count).slice(0, 12);
  charts.push(new Chart(document.getElementById("chartVotes"), {
    type: "bar",
    data: {
      labels: byVotes.map(e => e.name),
      datasets: [{
        label: "Votes",
        data: byVotes.map(e => e.count),
        backgroundColor: accent,
        borderColor: ink,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,.06)" } },
        y: { grid: { display: false } }
      }
    }
  }));

  // --- 2) Camembert : répartition des votes (les profs les plus votés) ---
  const TOP = 8;
  const top = byVotes.slice(0, TOP);
  const pieLabels = top.map(e => e.name);
  const pieData   = top.map(e => e.count);
  charts.push(new Chart(document.getElementById("chartPie"), {
    type: "pie",
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: pieLabels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: ink,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 14, padding: 8 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? Math.round(ctx.parsed / total * 100) : 0;
              return ` ${ctx.label} : ${ctx.parsed} vote${ctx.parsed > 1 ? "s" : ""} (${pct}%)`;
            }
          }
        }
      }
    }
  }));

  // --- 3) Toile d'araignée : comparaison du top (score pondéré) ---
  const radarTop = list.slice(0, Math.min(6, list.length));
  if (radarTop.length >= 3) {
    charts.push(new Chart(document.getElementById("chartRadar"), {
      type: "radar",
      data: {
        labels: radarTop.map(e => e.name),
        datasets: [{
          label: "Score pondéré (%)",
          data: radarTop.map(e => Math.round(e.score * 100)),
          backgroundColor: hexToRgba(primary, 0.25),
          borderColor: primary,
          borderWidth: 2,
          pointBackgroundColor: primary,
          pointBorderColor: ink
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            suggestedMin: 0, suggestedMax: 100,
            ticks: { backdropColor: "transparent", stepSize: 25 },
            pointLabels: { font: { size: 12 } }
          }
        }
      }
    }));
  } else {
    hideCard("chartRadar");
  }

  // --- 4) Nuage 2D : popularité (votes) vs note (score pondéré) ---
  charts.push(new Chart(document.getElementById("chartScatter"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Profs",
        data: list.map(e => ({ x: e.count, y: Math.round(e.score * 100), name: e.name })),
        backgroundColor: hexToRgba(accent, 0.7),
        borderColor: ink,
        borderWidth: 1.5,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw;
              return `${d.name} : ${d.y}% · ${d.x} vote${d.x > 1 ? "s" : ""}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: "Nombre de votes" }, beginAtZero: true,
             ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,.06)" } },
        y: { title: { display: true, text: "Score pondéré (%)" }, suggestedMin: 0, suggestedMax: 100,
             grid: { color: "rgba(0,0,0,.06)" } }
      }
    }
  }));
}

function hideCard(canvasId) {
  const card = document.getElementById(canvasId)?.closest(".stats-chart-card");
  if (card) card.style.display = "none";
}

function hexToRgba(hex, alpha) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
