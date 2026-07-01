// ============================================================
//  FICHE PROF — commentaires, avis et réactions
//  ------------------------------------------------------------
//  • Un prof est identifié entre tous les boards par son NOM
//    normalisé (même logique que les stats) → targetKey "prof:<nom>".
//  • comments/{id} : { authorUid, authorName, targetType, targetKey,
//                      text, createdAt, reactions: {emojiKey: [uid]} }
//  • reactions/{targetKey} : réactions rapides sur le prof lui-même
//                      { emojiKey: [uid, ...] }
//  SÉCURITÉ / ANTI-ABUS :
//  • XSS : tout texte utilisateur est inséré via textContent/escapeHtml.
//  • Validation : 2–500 caractères, vérifiée client ET règles Firestore.
//  • Rate-limit : 1 commentaire / 15 s, IMPOSÉ par les règles Firestore
//    (le batch doit mettre à jour users/{uid}.lastCommentAt, comparé
//    côté serveur à l'horodatage du commentaire précédent).
// ============================================================

import { db } from "./firebase-config.js?v=14";
import {
  doc, collection, query, where, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getState, uid as newId } from "./store.js?v=14";
import { escapeHtml, icon } from "./util.js?v=14";
import { norm } from "./catalog.js?v=14";
import { logActivity } from "./social.js?v=14";

// Réactions proposées (clé stockée en base → emoji affiché ; les clés
// restent en ASCII pour être utilisables dans des chemins de champ Firestore)
export const EMOJIS = { up: "👍", heart: "❤️", haha: "😂", wow: "😮", skull: "💀" };

let current = null;   // { name, key, entry } — fiche ouverte

const profKey = (name) => ("prof:" + norm(name)).replace(/\//g, "_");

export function initComments() {
  document.getElementById("closeProfBtn").onclick = () =>
    document.getElementById("profModal").classList.remove("open");

  document.getElementById("commentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await postComment();
  });
}

// ------------------------------------------------------------
//  OUVERTURE DE LA FICHE (depuis les stats : entry = ligne du classement)
// ------------------------------------------------------------
export async function openProf(entry) {
  const name = typeof entry === "string" ? entry : entry.name;
  current = { name, key: profKey(name), entry: typeof entry === "string" ? null : entry };

  document.getElementById("profModalName").textContent = name;
  document.getElementById("commentMsg").textContent = "";
  document.getElementById("commentText").value = "";
  renderSummary();
  document.getElementById("profReactions").innerHTML = `<p class="hint">Chargement…</p>`;
  document.getElementById("profComments").innerHTML = `<p class="hint">Chargement…</p>`;
  document.getElementById("profModal").classList.add("open");

  try {
    await Promise.all([loadProfReactions(), loadComments()]);
  } catch (e) {
    console.error("Fiche prof :", e);
    document.getElementById("profComments").innerHTML =
      `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function renderSummary() {
  const box = document.getElementById("profSummary");
  const e = current.entry;
  if (!e) { box.innerHTML = ""; return; }
  const pct = Math.round(e.score * 100);
  box.innerHTML =
    `<div class="stat-bar"><span style="width:${pct}%"></span></div>` +
    `<p class="stat-meta">${pct}% pondéré · classé par ${e.count} personne${e.count > 1 ? "s" : ""}` +
    (e.branchLabel ? ` · ${escapeHtml(e.branchLabel)}` : "") + `</p>`;
}

// ------------------------------------------------------------
//  RÉACTIONS RAPIDES SUR LE PROF
// ------------------------------------------------------------
async function loadProfReactions() {
  const snap = await getDoc(doc(db, "reactions", current.key));
  renderReactionBar(document.getElementById("profReactions"),
                    snap.exists() ? snap.data() : {}, toggleProfReaction);
}

async function toggleProfReaction(emojiKey, hasMine) {
  const { uid } = getState();
  const ref = doc(db, "reactions", current.key);
  await setDoc(ref, {
    [emojiKey]: hasMine ? arrayRemove(uid) : arrayUnion(uid)
  }, { merge: true });
  await loadProfReactions();
}

// Barre d'emojis générique (fiche prof et commentaires)
function renderReactionBar(container, reactions, onToggle) {
  const { uid } = getState();
  container.innerHTML = "";
  Object.entries(EMOJIS).forEach(([key, emoji]) => {
    const users = reactions[key] || [];
    const mine = users.includes(uid);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "react-btn" + (mine ? " react-btn-on" : "");
    btn.textContent = emoji + (users.length ? " " + users.length : "");
    btn.title = mine ? "Retirer ma réaction" : "Réagir";
    btn.onclick = () => onToggle(key, mine).catch(e => console.error("Réaction :", e));
    container.appendChild(btn);
  });
}

// ------------------------------------------------------------
//  COMMENTAIRES
// ------------------------------------------------------------
async function loadComments() {
  // Pas de orderBy Firestore (éviterait un index composite) : tri client.
  const qs = await getDocs(query(
    collection(db, "comments"),
    where("targetKey", "==", current.key)
  ));
  const list = [];
  qs.forEach(d => list.push({ id: d.id, ...d.data() }));
  list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  renderComments(list);
}

function renderComments(list) {
  const box = document.getElementById("profComments");
  const { uid } = getState();
  box.innerHTML = "";

  if (!list.length) {
    box.innerHTML = `<p class="hint">Aucun commentaire — sois la première personne à donner ton avis 🙂</p>`;
    return;
  }

  list.forEach(c => {
    const item = document.createElement("div");
    item.className = "comment-item";

    const head = document.createElement("div");
    head.className = "comment-head";

    const author = document.createElement("span");
    author.className = "comment-author";
    author.textContent = c.authorName || "Quelqu'un";

    const when = document.createElement("span");
    when.className = "comment-when";
    when.textContent = relativeTime(c.createdAt);

    head.append(author, when);

    if (c.authorUid === uid) {
      const del = document.createElement("button");
      del.className = "btn btn-ghost btn-sm comment-del";
      del.type = "button";
      del.append(icon("delete"));
      del.title = "Supprimer mon commentaire";
      del.onclick = async () => {
        await deleteDoc(doc(db, "comments", c.id));
        await loadComments();
      };
      head.appendChild(del);
    }

    const text = document.createElement("p");
    text.className = "comment-text";
    text.textContent = c.text;    // textContent → aucune injection HTML possible

    const reacts = document.createElement("div");
    reacts.className = "react-bar react-bar-sm";
    renderReactionBar(reacts, c.reactions || {}, async (key, mine) => {
      await updateDoc(doc(db, "comments", c.id), {
        ["reactions." + key]: mine ? arrayRemove(uid) : arrayUnion(uid)
      });
      await loadComments();
    });

    item.append(head, text, reacts);
    box.appendChild(item);
  });
}

let sendCooldown = false;

async function postComment() {
  const { uid, displayName } = getState();
  const ta = document.getElementById("commentText");
  const btn = document.getElementById("commentSendBtn");
  const msg = document.getElementById("commentMsg");
  const text = ta.value.trim();

  if (text.length < 2)   { msg.textContent = "Commentaire trop court 😉"; return; }
  if (text.length > 500) { msg.textContent = "Maximum 500 caractères ⚠️"; return; }
  if (sendCooldown)      { msg.textContent = "Doucement ! Attends quelques secondes ⏳"; return; }

  msg.textContent = "Publication…";
  btn.disabled = true;
  try {
    // Batch : le commentaire + users/{uid}.lastCommentAt DOIVENT partir
    // ensemble, c'est ce que vérifient les règles Firestore (anti-spam).
    const batch = writeBatch(db);
    batch.set(doc(db, "comments", newId("c")), {
      authorUid: uid,
      authorName: displayName || "Quelqu'un",
      targetType: "prof",
      targetKey: current.key,
      text,
      reactions: {},
      createdAt: serverTimestamp()
    });
    batch.set(doc(db, "users", uid), { lastCommentAt: serverTimestamp() }, { merge: true });
    await batch.commit();

    ta.value = "";
    msg.textContent = "";
    sendCooldown = true;
    setTimeout(() => { sendCooldown = false; }, 15000);
    logActivity("comment", `a commenté ${current.name}`);
    await loadComments();
  } catch (e) {
    console.error("Commentaire :", e);
    msg.textContent = e.code === "permission-denied"
      ? "Trop rapide ! Attends 15 s entre deux commentaires ⏳"
      : "Erreur : " + (e.code || e.message);
  } finally {
    btn.disabled = false;
  }
}

function relativeTime(ts) {
  if (!ts?.seconds) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts.seconds));
  if (s < 60)     return "à l'instant";
  if (s < 3600)   return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400)  return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export { relativeTime };
