// ============================================================
//  GALERIE COMMUNE — voir les tier lists de tout le monde
// ============================================================

import { loadAllBoards } from "./store.js?v=5";
import { escapeHtml } from "./util.js?v=5";

export function initGallery() {
  document.getElementById("openGalleryBtn").onclick = openGallery;
  document.getElementById("closeGalleryBtn").onclick = () =>
    document.getElementById("galleryModal").classList.remove("open");
}

async function openGallery() {
  const modal = document.getElementById("galleryModal");
  const box = document.getElementById("galleryContent");
  modal.classList.add("open");
  box.innerHTML = `<p class="hint">Chargement des tier lists…</p>`;
  try {
    const boards = await loadAllBoards();
    renderGallery(boards);
  } catch (e) {
    box.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function renderGallery(boards) {
  const box = document.getElementById("galleryContent");
  box.innerHTML = "";

  if (!boards.length) {
    box.innerHTML = `<p class="hint">Aucune tier list pour l'instant.</p>`;
    return;
  }

  boards.forEach(b => {
    const ranks = b.ranks || [];
    const profs = b.professors || [];
    const tiers = b.tiers || {};

    const card = document.createElement("div");
    card.className = "gallery-card";

    const title = document.createElement("h3");
    title.textContent = b.displayName || b.uid;
    card.appendChild(title);

    ranks.forEach(rank => {
      const names = (tiers[rank.id] || [])
        .map(id => profs.find(p => p.id === id))
        .filter(Boolean)
        .map(p => p.name);

      const row = document.createElement("div");
      row.className = "ranking-row";

      const lab = document.createElement("span");
      lab.className = "ranking-label";
      lab.style.background = rank.color;
      lab.textContent = rank.label;

      const list = document.createElement("span");
      list.className = "ranking-names";
      list.textContent = names.length ? names.join(", ") : "—";

      row.append(lab, list);
      card.appendChild(row);
    });

    box.appendChild(card);
  });
}
