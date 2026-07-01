// ============================================================
//  COUCHE DE DONNÉES — Un tableau (board) par utilisateur
//  boards/{uid} = { displayName, theme, branches, ranks, professors, tiers }
//  - Chacun modifie SON board (profs, branches, rangs, apparence, classement)
//  - Tout le monde peut LIRE tous les boards (galerie commune)
// ============================================================

import { db } from "./firebase-config.js?v=14";
import {
  doc, getDoc, setDoc, onSnapshot, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// ============================================================
//  THÈME PAR DÉFAUT
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
//  CONTENU DE DÉPART d'un nouveau board (profs HEIG + rangs S→D)
//  Chacun part avec ça, puis personnalise librement.
// ============================================================
export const DEFAULT_BOARD = {
  theme: { ...DEFAULT_THEME },
  branches: [
    { id: "b_82mxdw6", name: "Physique 3" },
    { id: "b_96xk7de", name: "Syslog1" },
    { id: "b_azorxxx", name: "Math Elec 2" },
    { id: "b_d0w3bu8", name: "Electro 2" },
    { id: "b_lt0j637", name: "Python GE 2" },
    { id: "b_r5nefqg", name: "TechMes" },
    { id: "b_r3a4cvm", name: "Math Tin 3" },
    { id: "b_0z5gxj3", name: "Regul Auto" },
    { id: "b_20hqbzp", name: "El Puissan" },
    { id: "b_ybjumgl", name: "Mecatro 1" },
    { id: "b_y0xmh1b", name: "SignSys" },
    { id: "b_g7zaip0", name: "Gestion de Projet" }
  ],
  ranks: [
    { id: "S", label: "S", color: "#ff5d5d" },
    { id: "A", label: "A", color: "#ffa14a" },
    { id: "B", label: "B", color: "#ffd84a" },
    { id: "C", label: "C", color: "#7ed957" },
    { id: "D", label: "D", color: "#4ab8ff" }
  ],
  professors: [
    { id: "p_gz3n5ew", name: "Messerli Etienne",   branchId: "b_96xk7de" },
    { id: "p_bt52myw", name: "Chaudet Bastien",    branchId: "b_azorxxx" },
    { id: "p_8wsqzhb", name: "Grandjean Blaise",   branchId: "b_d0w3bu8" },
    { id: "p_in7nhfx", name: "Chevallier Yves",    branchId: "b_lt0j637" },
    { id: "p_7sd3qzl", name: "Jolissaint Laurent", branchId: "b_r5nefqg" },
    { id: "p_4177eci", name: "Fornerod Jean",      branchId: "b_r3a4cvm" },
    { id: "p_s765xke", name: "Bornand Cédric",     branchId: "b_r5nefqg" },
    { id: "p_7y0qz58", name: "Bozorg Mokhtar",     branchId: "b_0z5gxj3" },
    { id: "p_m5kcle5", name: "Siemaszko Daniel",   branchId: "b_20hqbzp" },
    { id: "p_p61p1us", name: "Bossoney Luc",       branchId: "b_ybjumgl" },
    { id: "p_y54bjoc", name: "Lavanchy David",     branchId: "b_y0xmh1b" },
    { id: "p_xihf1tg", name: "Schintke Silvia",    branchId: "b_82mxdw6" },
    { id: "p_6bsoah2", name: "Umberti Philippe",   branchId: "b_g7zaip0" }
  ],
  tiers: {}   // rankId -> [profId, ...] (ordonné)
};

// Convertit un éventuel ancien format { profId: rankId } vers { rankId: [profId] }
function tiersFromPlacements(placements) {
  const t = {};
  Object.entries(placements || {}).forEach(([profId, rankId]) => {
    (t[rankId] = t[rankId] || []).push(profId);
  });
  return t;
}

// ============================================================
//  ÉTAT GLOBAL
// ============================================================
let state = {
  board: null,         // { theme, branches, ranks, professors, tiers }
  displayName: "",
  uid: null,
  ready: false,
  error: null
};

const listeners = new Set();
export function getState() { return state; }
export function onState(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit() { listeners.forEach(cb => cb(state)); }

let myRef = null;
let saveTimer = null;

// ============================================================
//  INITIALISATION (à la connexion)
// ============================================================
export async function initStore(user) {
  state.uid = user.uid;
  state.displayName = user.displayName
    || (user.email ? user.email.split("@")[0] : "Utilisateur");

  myRef = doc(db, "boards", user.uid);

  try {
    const snap = await getDoc(myRef);
    if (!snap.exists()) {
      await setDoc(myRef, {
        displayName: state.displayName,
        ...structuredClone(DEFAULT_BOARD),
        updatedAt: serverTimestamp()
      });
    }
  } catch (e) {
    console.error("❌ Init board :", e);
    state.error = "Accès refusé. As-tu publié les nouvelles règles Firestore ? (" + (e.code || e.message) + ")";
    state.ready = true;
    emit();
  }

  onSnapshot(myRef, (s) => {
    if (!s.exists()) { state.ready = true; emit(); return; }
    const d = s.data();
    state.board = {
      theme:      { ...DEFAULT_THEME, ...(d.theme || {}) },
      branches:   d.branches   || [],
      ranks:      d.ranks      || [],
      professors: d.professors || [],
      tiers:      d.tiers || tiersFromPlacements(d.placements)
    };
    if (d.displayName) state.displayName = d.displayName;
    state.error = null;
    state.ready = true;
    emit();
  }, (err) => {
    console.error("❌ Lecture board :", err);
    state.error = "Lecture refusée. Vérifie les règles Firestore. (" + (err.code || err.message) + ")";
    emit();
  });
}

// ============================================================
//  ÉDITION DE SON BOARD (profs, branches, rangs, apparence)
// ============================================================
export function commitBoard(mutator) {
  if (!state.board) return;
  const draft = structuredClone(state.board);
  mutator(draft);
  state.board = draft;
  emit();
  scheduleSave();
}

// ============================================================
//  DÉPLACER UN PROF dans un rang à une position précise
//  rankId = null → renvoyé dans la banque ; index = position (0 = gauche)
// ============================================================
export function moveProf(profId, rankId, index) {
  if (!state.board) return;
  const board = structuredClone(state.board);
  const tiers = board.tiers || {};

  for (const k of Object.keys(tiers)) {
    tiers[k] = (tiers[k] || []).filter(id => id !== profId);
    if (!tiers[k].length) delete tiers[k];
  }
  if (rankId != null) {
    const arr = tiers[rankId] || [];
    const i = Math.max(0, Math.min(index == null ? arr.length : index, arr.length));
    arr.splice(i, 0, profId);
    tiers[rankId] = arr;
  }
  board.tiers = tiers;
  state.board = board;
  emit();
  scheduleSave();
}

// ============================================================
//  CHANGER SON PSEUDO
// ============================================================
export async function setDisplayName(name) {
  const clean = (name || "").trim();
  if (!clean || !myRef) return;
  state.displayName = clean;
  emit();
  await saveNow();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow().catch(e => console.error("❌ Sauvegarde :", e)), 350);
}

function saveNow() {
  if (!state.board) return Promise.resolve();
  return setDoc(myRef, {
    displayName: state.displayName,
    theme:      state.board.theme,
    branches:   state.board.branches,
    ranks:      state.board.ranks,
    professors: state.board.professors,
    tiers:      state.board.tiers,
    updatedAt:  serverTimestamp()
  });
}

// ============================================================
//  CHARGER TOUS LES BOARDS (galerie commune)
// ============================================================
export async function loadAllBoards() {
  const qs = await getDocs(collection(db, "boards"));
  const out = [];
  qs.forEach(d => out.push({ uid: d.id, ...d.data() }));
  return out;
}
