// ============================================================
//  GALERIE COMMUNE — liste des personnes → clic sur un nom pour
//  voir sa tier list EN GRAND (mêmes styles que le plateau
//  principal : rangs colorés + étiquettes de profs pleine taille,
//  en lecture seule). Bouton "Suivre" sur chaque personne.
// ============================================================

import { loadAllBoards, getState } from "./store.js?v=16";
import { escapeHtml, icon } from "./util.js?v=16";
import { isFollowing, follow, unfollow, loadAllProfiles } from "./profile.js?v=16";
import { filiereById } from "./catalog.js?v=16";

let lastBoards = [];
let lastProfiles = new Map();

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
    [lastBoards, lastProfiles] = await Promise.all([
      loadAllBoards(),
      loadAllProfiles().catch(() => new Map())
    ]);
    renderPeopleList();
  } catch (e) {
    box.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

// ------------------------------------------------------------
//  VUE 1 : liste des personnes
// ------------------------------------------------------------
function renderPeopleList() {
  const box = document.getElementById("galleryContent");
  const { uid: myUid } = getState();
  box.innerHTML = "";
  box.classList.remove("gallery-grid");
  box.classList.add("gallery-list");

  if (!lastBoards.length) {
    box.innerHTML = `<p class="hint">Aucune tier list pour l'instant.</p>`;
    return;
  }

  // Ma tier list d'abord, puis les plus actifs (profs classés)
  const boards = [...lastBoards].sort((a, b) =>
    ((b.uid === myUid) - (a.uid === myUid)) || (placedCount(b) - placedCount(a)));

  boards.forEach(b => {
    const profile = lastProfiles.get(b.uid);
    const nbPlaced = placedCount(b);

    const row = document.createElement("div");
    row.className = "gallery-person";

    const ic = icon("account_circle");
    ic.classList.add("gp-avatar");

    const info = document.createElement("div");
    info.className = "prop-info gp-info";
    const name = document.createElement("span");
    name.className = "gp-name";
    name.textContent = (b.displayName || b.uid) + (b.uid === myUid ? " (toi)" : "");
    const sub = document.createElement("span");
    sub.className = "prop-by";
    const fil = filiereById(profile?.filiereId)?.name;
    sub.textContent = `${nbPlaced} prof${nbPlaced > 1 ? "s" : ""} classé${nbPlaced > 1 ? "s" : ""}`
      + (fil ? ` · ${fil}` : "");
    info.append(name, sub);

    const view = document.createElement("button");
    view.type = "button";
    view.className = "btn btn-primary btn-sm";
    view.append(icon("visibility"));
    view.append(document.createTextNode(" Voir"));
    view.onclick = (e) => { e.stopPropagation(); renderBoardView(b); };

    row.append(ic, info);

    // Bouton Suivre / Suivi·e (pas sur sa propre ligne)
    if (b.uid !== myUid) row.appendChild(followButton(b.uid));
    row.appendChild(view);

    // Toute la ligne est cliquable (le nom en priorité)
    row.onclick = () => renderBoardView(b);
    box.appendChild(row);
  });
}

function placedCount(b) {
  return Object.values(b.tiers || {}).flat().length;
}

function followButton(uid) {
  const btn = document.createElement("button");
  btn.type = "button";
  const setLook = () => {
    const on = isFollowing(uid);
    btn.className = on ? "btn btn-ghost btn-sm" : "btn btn-accent btn-sm";
    btn.innerHTML = "";
    btn.append(icon(on ? "person_remove" : "person_add"));
    btn.append(document.createTextNode(on ? " Suivi·e" : " Suivre"));
  };
  setLook();
  btn.onclick = async (e) => {
    e.stopPropagation();      // ne pas ouvrir la tier list en même temps
    try {
      isFollowing(uid) ? await unfollow(uid) : await follow(uid);
      setLook();
    } catch (err) { console.error("Follow :", err); }
  };
  return btn;
}

// ------------------------------------------------------------
//  VUE 2 : la tier list d'une personne, en grand
//  Réutilise les classes du plateau principal (.tier-row, .chip…)
//  → mêmes tailles, mêmes retours à la ligne, responsive inclus.
// ------------------------------------------------------------
function renderBoardView(b) {
  const box = document.getElementById("galleryContent");
  const { uid: myUid } = getState();
  box.innerHTML = "";
  box.classList.remove("gallery-grid");
  box.classList.add("gallery-list");

  // En-tête : retour + nom + follow
  const head = document.createElement("div");
  head.className = "gv-head";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "btn btn-ghost btn-sm";
  back.append(icon("arrow_back"));
  back.append(document.createTextNode(" Retour"));
  back.onclick = renderPeopleList;

  const title = document.createElement("h3");
  title.className = "gv-title";
  title.textContent = b.displayName || b.uid;

  head.append(back, title);
  if (b.uid !== myUid) head.appendChild(followButton(b.uid));
  box.appendChild(head);

  // Rangs (lecture seule, pleine taille)
  const profs = b.professors || [];
  const tiers = b.tiers || {};
  const rows = document.createElement("div");
  rows.className = "tier-rows";

  (b.ranks || []).forEach(rank => {
    const row = document.createElement("div");
    row.className = "tier-row";

    const label = document.createElement("div");
    label.className = "tier-label";
    label.style.background = rank.color;
    label.textContent = rank.label;

    const zone = document.createElement("div");
    zone.className = "tier-zone";

    (tiers[rank.id] || []).forEach(profId => {
      const p = profs.find(x => x.id === profId);
      if (!p) return;
      const branch = (b.branches || []).find(x => x.id === p.branchId);
      const chip = document.createElement("div");
      chip.className = "chip chip-static";
      chip.innerHTML =
        `<span class="chip-name">${escapeHtml(p.name)}</span>` +
        (branch ? `<span class="chip-branch">${escapeHtml(branch.name)}</span>` : "");
      zone.appendChild(chip);
    });

    row.append(label, zone);
    rows.appendChild(row);
  });

  box.appendChild(rows);

  // Profs non classés (banque) — pour information
  const placed = new Set(Object.values(tiers).flat());
  const unplaced = profs.filter(p => !placed.has(p.id));
  if (unplaced.length) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = `${unplaced.length} prof${unplaced.length > 1 ? "s" : ""} pas encore classé${unplaced.length > 1 ? "s" : ""} : `
      + unplaced.map(p => p.name).join(", ");
    box.appendChild(hint);
  }
}
