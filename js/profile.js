// ============================================================
//  PROFIL UTILISATEUR — users/{uid}
//  ------------------------------------------------------------
//  Document séparé du board : profil public léger, lu par tout le
//  monde (filtres des stats, galerie, fil d'activité) :
//    { displayName, filiereId, orientationId, following: [uid],
//      lastCommentAt, createdAt, updatedAt }
//  • filiereId / orientationId : choisis à la première connexion
//    (onboarding) → persistés dans le COMPTE, pas seulement en session.
//  • following : liste des uid suivis (fonctions sociales).
//  • lastCommentAt : horodatage utilisé par les règles Firestore
//    comme anti-spam (1 commentaire max toutes les 15 s).
// ============================================================

import { db } from "./firebase-config.js?v=15";
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove,
  collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { loadCatalog, getCatalog, saveCatalog, filiereById } from "./catalog.js?v=15";
import { uid as newId } from "./store.js?v=15";
import { escapeHtml as esc } from "./util.js?v=15";

let profile = null;   // profil de l'utilisateur connecté
let myUid = null;

export function getProfile() { return profile; }

const myRef = () => doc(db, "users", myUid);

// ------------------------------------------------------------
//  INITIALISATION (à la connexion) : crée le doc s'il manque
// ------------------------------------------------------------
export async function initProfile(user, displayName) {
  myUid = user.uid;
  const snap = await getDoc(myRef());
  if (snap.exists()) {
    profile = snap.data();
    // Le pseudo peut avoir changé côté board : on le garde en phase.
    if (displayName && profile.displayName !== displayName) {
      profile.displayName = displayName;
      await setDoc(myRef(), { displayName, updatedAt: serverTimestamp() }, { merge: true });
    }
  } else {
    profile = {
      displayName: displayName || "Utilisateur",
      filiereId: "",
      orientationId: "",
      following: []
    };
    await setDoc(myRef(), { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  return profile;
}

// ------------------------------------------------------------
//  FILIÈRE / ORIENTATION
// ------------------------------------------------------------
export async function saveIdentity(filiereId, orientationId) {
  profile = { ...profile, filiereId: filiereId || "", orientationId: orientationId || "" };
  await setDoc(myRef(), {
    filiereId: profile.filiereId,
    orientationId: profile.orientationId,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// Libellé "Filière — Orientation" pour l'affichage
export function identityLabel() {
  if (!profile?.filiereId) return "Filière non renseignée";
  const f = filiereById(profile.filiereId);
  if (!f) return "Filière non renseignée";
  const o = (f.orientations || []).find(o => o.id === profile.orientationId);
  return f.name + (o ? " — " + o.name : "");
}

// ------------------------------------------------------------
//  FOLLOW / UNFOLLOW
// ------------------------------------------------------------
export function isFollowing(uid) {
  return (profile?.following || []).includes(uid);
}

export async function follow(uid) {
  if (!uid || uid === myUid || isFollowing(uid)) return;
  profile.following = [...(profile.following || []), uid];
  await updateDoc(myRef(), { following: arrayUnion(uid), updatedAt: serverTimestamp() });
}

export async function unfollow(uid) {
  profile.following = (profile.following || []).filter(u => u !== uid);
  await updateDoc(myRef(), { following: arrayRemove(uid), updatedAt: serverTimestamp() });
}

// ------------------------------------------------------------
//  TOUS LES PROFILS (filtres de stats, galerie, fil)
// ------------------------------------------------------------
export async function loadAllProfiles() {
  const qs = await getDocs(collection(db, "users"));
  const out = new Map();
  qs.forEach(d => out.set(d.id, { uid: d.id, ...d.data() }));
  return out;
}

// ============================================================
//  ONBOARDING — choisir sa filière / orientation
//  Ouvert automatiquement à la première connexion, puis
//  accessible depuis la modale profil ("Changer").
// ============================================================

export function initOnboarding(onSaved) {
  const modal = document.getElementById("onboardingModal");
  const selF  = document.getElementById("obFiliere");
  const selO  = document.getElementById("obOrientation");
  const msg   = document.getElementById("obMsg");

  document.getElementById("closeOnboardingBtn").onclick = () => modal.classList.remove("open");

  selF.onchange = () => populateOrientations(selF.value, "");

  // La liste de démarrage est une démo : chacun peut ajouter sa filière ici.
  document.getElementById("obAddFiliereBtn").onclick = async () => {
    const name = document.getElementById("obNewFiliere").value.trim();
    if (!name) return;
    const id = newId("f");
    await saveCatalog(d => d.filieres.push({ id, name, orientations: [] }));
    document.getElementById("obNewFiliere").value = "";
    populateFilieres(id);
  };

  document.getElementById("obSaveBtn").onclick = async () => {
    msg.textContent = "Enregistrement…";
    try {
      await saveIdentity(selF.value, selO.value);
      msg.textContent = "";
      modal.classList.remove("open");
      if (onSaved) onSaved();
    } catch (e) {
      console.error("Onboarding :", e);
      msg.textContent = "Erreur : " + (e.code || e.message);
    }
  };
}

export async function openOnboarding() {
  await loadCatalog();
  populateFilieres(profile?.filiereId || "");
  document.getElementById("obMsg").textContent = "";
  document.getElementById("onboardingModal").classList.add("open");
}

function populateFilieres(selectedId) {
  const selF = document.getElementById("obFiliere");
  const cat = getCatalog();
  selF.innerHTML = `<option value="">— Choisir ma filière —</option>` +
    cat.filieres.map(f =>
      `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${esc(f.name)}</option>`
    ).join("");
  populateOrientations(selF.value, profile?.orientationId || "");
}

function populateOrientations(filiereId, selectedId) {
  const selO = document.getElementById("obOrientation");
  const f = filiereById(filiereId);
  const list = f?.orientations || [];
  if (!list.length) {
    selO.innerHTML = `<option value="">— Pas d'orientation —</option>`;
    selO.disabled = true;
    return;
  }
  selO.disabled = false;
  selO.innerHTML = `<option value="">— Choisir (optionnel) —</option>` +
    list.map(o =>
      `<option value="${o.id}" ${o.id === selectedId ? "selected" : ""}>${esc(o.name)}</option>`
    ).join("");
}
