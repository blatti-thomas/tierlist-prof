// ============================================================
//  SOCIAL — follow entre utilisateurs + fil d'activité
//  ------------------------------------------------------------
//  • activity/{id} : { uid, name, type: "comment"|"board"|"game",
//                      text, createdAt } — événements écrits par les
//    clients à chaque action notable (commentaire, tier list mise à
//    jour, partie jouée). Append-only (règles : pas d'update/delete).
//  • Le fil = les derniers événements des personnes que je suis
//    (users/{moi}.following). Le filtrage se fait CÔTÉ CLIENT sur les
//    ~100 derniers événements : évite un index composite Firestore et
//    suffit largement à cette échelle (petite communauté).
//  • Badge "nouveautés" : horodatage de dernière lecture en localStorage.
// ============================================================

import { db } from "./firebase-config.js?v=16";
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getState } from "./store.js?v=16";
import { getProfile, isFollowing, follow, unfollow, loadAllProfiles } from "./profile.js?v=16";
import { filiereById } from "./catalog.js?v=16";
import { escapeHtml, icon, relativeTime } from "./util.js?v=16";

const TYPE_ICON = { comment: "chat_bubble", board: "format_list_numbered", game: "sports_esports" };

export function initSocial() {
  document.getElementById("openFeedBtn").onclick = openFeed;
  document.getElementById("closeFeedBtn").onclick = () =>
    document.getElementById("feedModal").classList.remove("open");
}

// ------------------------------------------------------------
//  JOURNAL D'ACTIVITÉ (fire-and-forget : ne bloque jamais l'action)
// ------------------------------------------------------------
export function logActivity(type, text) {
  const { uid, displayName } = getState();
  if (!uid) return;
  addDoc(collection(db, "activity"), {
    uid,
    name: displayName || "Quelqu'un",
    type,
    text: String(text).slice(0, 200),
    createdAt: serverTimestamp()
  }).catch(e => console.warn("Activité non journalisée :", e.code || e.message));
}

// Tier list mise à jour : au plus 1 événement toutes les 10 minutes
// (la sauvegarde du board part à chaque glisser-déposer).
export function logBoardActivity() {
  const { uid } = getState();
  if (!uid) return;
  const key = "boardActivityAt_" + uid;
  const last = Number(localStorage.getItem(key) || 0);
  if (Date.now() - last < 10 * 60 * 1000) return;
  localStorage.setItem(key, String(Date.now()));
  logActivity("board", "a mis à jour sa tier list");
}

// ------------------------------------------------------------
//  FIL D'ACTIVITÉ
// ------------------------------------------------------------
async function loadRecentActivity() {
  const qs = await getDocs(query(
    collection(db, "activity"), orderBy("createdAt", "desc"), limit(100)
  ));
  const out = [];
  qs.forEach(d => out.push({ id: d.id, ...d.data() }));
  return out;
}

async function openFeed() {
  const modal = document.getElementById("feedModal");
  modal.classList.add("open");
  document.getElementById("feedPeople").innerHTML = `<p class="hint">Chargement…</p>`;
  document.getElementById("feedItems").innerHTML = `<p class="hint">Chargement…</p>`;

  try {
    const [profiles, activity] = await Promise.all([loadAllProfiles(), loadRecentActivity()]);
    renderPeople(profiles);
    renderFeed(activity);
    // Marque le fil comme lu → le badge disparaît
    const { uid } = getState();
    localStorage.setItem("feedSeenAt_" + uid, String(Date.now()));
    setBadge(0);
  } catch (e) {
    console.error("Fil :", e);
    document.getElementById("feedItems").innerHTML =
      `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function renderPeople(profiles) {
  const box = document.getElementById("feedPeople");
  const { uid: myUid } = getState();
  box.innerHTML = "";

  const others = [...profiles.values()].filter(p => p.uid !== myUid);
  if (!others.length) {
    box.innerHTML = `<p class="hint">Personne d'autre pour l'instant.</p>`;
    return;
  }
  // Les personnes suivies d'abord, puis par pseudo
  others.sort((a, b) => (isFollowing(b.uid) - isFollowing(a.uid))
    || (a.displayName || "").localeCompare(b.displayName || ""));

  others.forEach(p => {
    const row = document.createElement("div");
    row.className = "feed-person";

    const info = document.createElement("div");
    info.className = "prop-info";
    const name = document.createElement("span");
    name.className = "prop-name";
    name.textContent = p.displayName || "Quelqu'un";
    const fil = document.createElement("span");
    fil.className = "prop-by";
    fil.textContent = filiereById(p.filiereId)?.name || "Filière non renseignée";
    info.append(name, fil);

    const btn = document.createElement("button");
    btn.type = "button";
    const followed = isFollowing(p.uid);
    btn.className = followed ? "btn btn-ghost btn-sm" : "btn btn-accent btn-sm";
    btn.append(icon(followed ? "person_remove" : "person_add"));
    btn.append(document.createTextNode(followed ? " Suivi·e" : " Suivre"));
    btn.onclick = async () => {
      try {
        followed ? await unfollow(p.uid) : await follow(p.uid);
        renderPeople(profiles);
      } catch (e) { console.error("Follow :", e); }
    };

    row.append(info, btn);
    box.appendChild(row);
  });
}

function renderFeed(activity) {
  const box = document.getElementById("feedItems");
  const following = new Set(getProfile()?.following || []);
  box.innerHTML = "";

  const items = activity.filter(a => following.has(a.uid));
  if (!items.length) {
    box.innerHTML = following.size
      ? `<p class="hint">Rien de neuf chez les personnes que tu suis.</p>`
      : `<p class="hint">Suis quelqu'un (à gauche ou dans la galerie) pour voir son activité ici.</p>`;
    return;
  }

  items.forEach(a => {
    const row = document.createElement("div");
    row.className = "feed-item";

    const ic = icon(TYPE_ICON[a.type] || "bolt");
    ic.classList.add("feed-icon");

    const main = document.createElement("div");
    main.className = "prop-info";
    const line = document.createElement("span");
    line.className = "prop-name";
    line.textContent = `${a.name || "Quelqu'un"} ${a.text || ""}`;
    const when = document.createElement("span");
    when.className = "prop-by";
    when.textContent = relativeTime(a.createdAt);
    main.append(line, when);

    row.append(ic, main);
    box.appendChild(row);
  });
}

// ------------------------------------------------------------
//  BADGE "NOUVEAUTÉS" sur le bouton Fil (appelé après connexion)
// ------------------------------------------------------------
export async function refreshFeedBadge() {
  try {
    const { uid } = getState();
    const following = new Set(getProfile()?.following || []);
    if (!following.size) { setBadge(0); return; }
    const seen = Number(localStorage.getItem("feedSeenAt_" + uid) || 0);
    const activity = await loadRecentActivity();
    const n = activity.filter(a =>
      following.has(a.uid) && (a.createdAt?.seconds || 0) * 1000 > seen).length;
    setBadge(n);
  } catch (e) {
    console.warn("Badge fil :", e.code || e.message);
  }
}

function setBadge(n) {
  const b = document.getElementById("feedBadge");
  if (!b) return;
  b.textContent = n > 9 ? "9+" : String(n);
  b.classList.toggle("hidden", !n);
}
