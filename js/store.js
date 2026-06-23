// ============================================================
//  COUCHE DE DONNÉES
//  - config/main         : profs, branches, rangs, apparence (admin)
//  - rankings/{uid}      : le classement personnel de chaque utilisateur
// ============================================================

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, onSnapshot, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CONFIG_REF = doc(db, "config", "main");

// --- ID court et unique pour les nouveaux éléments
export function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// ============================================================
//  THÈME PAR DÉFAUT (apparence personnalisable)
// ============================================================
export const DEFAULT_THEME = {
  font: "Fredoka",
  baseSize: 16,
  bg: "#fff7e8",
  text: "#15151e",
  border: "#15151e",
  primary: "#ff5d8f",
  accent: "#4ab8ff",
  radius: 22
};

// ============================================================
//  CONFIG PAR DÉFAUT (créée par l'admin au 1er lancement)
//  Contient des profs de test en Mécatronique.
// ============================================================
export const DEFAULT_CONFIG = {
  theme: { ...DEFAULT_THEME },
  branches: [
    { id: "mecatronique", name: "Mécatronique" },
    { id: "electronique", name: "Électronique embarquée" },
    { id: "maths",        name: "Mathématiques" }
  ],
  ranks: [
    { id: "S", label: "S", color: "#ff5d5d" },
    { id: "A", label: "A", color: "#ffa14a" },
    { id: "B", label: "B", color: "#ffd84a" },
    { id: "C", label: "C", color: "#7ed957" },
    { id: "D", label: "D", color: "#4ab8ff" }
  ],
  professors: [
    { id: "p_marc",   name: "Marc Dubois",    branchId: "mecatronique" },
    { id: "p_sophie", name: "Sophie Lehmann",  branchId: "mecatronique" },
    { id: "p_ali",    name: "Ali Benkacem",    branchId: "mecatronique" },
    { id: "p_nadia",  name: "Nadia Rochat",    branchId: "mecatronique" },
    { id: "p_pierre", name: "Pierre Müller",   branchId: "mecatronique" },
    { id: "p_luca",   name: "Luca Bianchi",    branchId: "electronique" },
    { id: "p_eva",    name: "Eva Schneider",   branchId: "maths" }
  ]
};

// ============================================================
//  ÉTAT GLOBAL
// ============================================================
let state = {
  config: null,        // { theme, branches, ranks, professors }
  placements: {},      // classement personnel : profId -> rankId
  isAdmin: false,
  displayName: "",
  uid: null,
  ready: false
};

const listeners = new Set();
export function getState() { return state; }
export function onState(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit() { listeners.forEach(cb => cb(state)); }

let userRef = null;
let configSaveTimer = null;
let rankSaveTimer = null;

// ============================================================
//  INITIALISATION (à la connexion)
// ============================================================
export async function initStore(user, admin) {
  state.uid = user.uid;
  state.isAdmin = admin;
  state.displayName = user.displayName
    || (user.email ? user.email.split("@")[0] : "Utilisateur");

  // ---------- CONFIG partagée ----------
  const snap = await getDoc(CONFIG_REF);
  if (!snap.exists() && admin) {
    await setDoc(CONFIG_REF, { ...DEFAULT_CONFIG, updatedAt: serverTimestamp() });
  }
  onSnapshot(CONFIG_REF, (s) => {
    if (!s.exists()) { state.ready = true; emit(); return; }
    const d = s.data();
    state.config = {
      theme:      { ...DEFAULT_THEME, ...(d.theme || {}) },
      branches:   d.branches   || [],
      ranks:      d.ranks      || [],
      professors: d.professors || []
    };
    state.ready = true;
    emit();
  });

  // ---------- Classement personnel ----------
  userRef = doc(db, "rankings", user.uid);
  const rsnap = await getDoc(userRef);
  if (!rsnap.exists()) {
    await setDoc(userRef, {
      displayName: state.displayName,
      placements: {},
      updatedAt: serverTimestamp()
    });
  }
  onSnapshot(userRef, (s) => {
    if (!s.exists()) return;
    state.placements = s.data().placements || {};
    emit();
  });
}

// ============================================================
//  ÉDITION DE LA CONFIG (admin uniquement)
// ============================================================
export function commitConfig(mutator) {
  if (!state.config) return;
  const draft = structuredClone(state.config);
  mutator(draft);
  state.config = draft;
  emit();
  clearTimeout(configSaveTimer);
  configSaveTimer = setTimeout(async () => {
    try {
      await setDoc(CONFIG_REF, { ...state.config, updatedAt: serverTimestamp() });
    } catch (e) { console.error("❌ Sauvegarde config :", e); }
  }, 400);
}

// ============================================================
//  PLACEMENT D'UN PROF (classement personnel de l'utilisateur)
//  rankId = null  → renvoyé dans la banque
// ============================================================
export function setPlacement(profId, rankId) {
  const p = { ...state.placements };
  if (rankId == null) delete p[profId];
  else p[profId] = rankId;
  state.placements = p;
  emit();
  clearTimeout(rankSaveTimer);
  rankSaveTimer = setTimeout(async () => {
    try {
      await setDoc(userRef, {
        displayName: state.displayName,
        placements: state.placements,
        updatedAt: serverTimestamp()
      });
    } catch (e) { console.error("❌ Sauvegarde classement :", e); }
  }, 300);
}

// ============================================================
//  CHARGER TOUS LES CLASSEMENTS (admin uniquement)
// ============================================================
export async function loadAllRankings() {
  const qs = await getDocs(collection(db, "rankings"));
  const out = [];
  qs.forEach(d => out.push({ uid: d.id, ...d.data() }));
  return out;
}
