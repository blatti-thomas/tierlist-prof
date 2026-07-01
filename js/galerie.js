// ============================================================
//  GALERIE COMMUNE — voir les tier lists de tout le monde
//  + suivre leurs auteurs (fil d'activité)
// ============================================================

import { loadAllBoards, getState } from "./store.js?v=15";
import { escapeHtml, icon } from "./util.js?v=15";
import { isFollowing, follow, unfollow, loadAllProfiles } from "./profile.js?v=15";
import { filiereById } from "./catalog.js?v=15";

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
    // Les profils peuvent être refusés tant que les nouvelles règles
    // Firestore ne sont pas publiées : la galerie s'affiche quand même.
    const [boards, profiles] = await Promise.all([
      loadAllBoards(),
      loadAllProfiles().catch(() => new Map())
    ]);
    renderGallery(boards, profiles);
  } catch (e) {
    box.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function renderGallery(boards, profiles) {
  const box = document.getElementById("galleryContent");
  const { uid: myUid } = getState();
  box.innerHTML = "";

  if (!boards.length) {
    box.innerHTML = `<p class="hint">Aucune tier list pour l'instant.</p>`;
    return;
  }

  boards.forEach(b => {
    const ranks = b.ranks || [];
    const profs = b.professors || [];
    const tiers = b.tiers || {};
    const profile = profiles.get(b.uid);

    const card = document.createElement("div");
    card.className = "gallery-card";

    const head = document.createElement("div");
    head.className = "gallery-head";

    const titleWrap = document.createElement("div");
    titleWrap.className = "prop-info";
    const title = document.createElement("h3");
    title.textContent = b.displayName || b.uid;
    titleWrap.appendChild(title);
    const fil = filiereById(profile?.filiereId)?.name;
    if (fil) {
      const sub = document.createElement("span");
      sub.className = "prop-by";
      sub.textContent = fil;
      titleWrap.appendChild(sub);
    }
    head.appendChild(titleWrap);

    // Bouton Suivre / Suivi·e (pas sur sa propre carte)
    if (b.uid !== myUid) {
      const btn = document.createElement("button");
      btn.type = "button";
      const setLook = () => {
        const on = isFollowing(b.uid);
        btn.className = on ? "btn btn-ghost btn-sm" : "btn btn-accent btn-sm";
        btn.innerHTML = "";
        btn.append(icon(on ? "person_remove" : "person_add"));
        btn.append(document.createTextNode(on ? " Suivi·e" : " Suivre"));
      };
      setLook();
      btn.onclick = async () => {
        try {
          isFollowing(b.uid) ? await unfollow(b.uid) : await follow(b.uid);
          setLook();
        } catch (e) { console.error("Follow :", e); }
      };
      head.appendChild(btn);
    }

    card.appendChild(head);

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
      lab.title = rank.label;   // nom complet au survol (libellé tronqué si long)

      const list = document.createElement("span");
      list.className = "ranking-names";
      list.textContent = names.length ? names.join(", ") : "—";

      row.append(lab, list);
      card.appendChild(row);
    });

    box.appendChild(card);
  });
}
