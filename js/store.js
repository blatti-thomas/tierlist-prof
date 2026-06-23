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
