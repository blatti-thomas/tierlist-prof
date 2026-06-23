// ============================================================
//  COUCHE DE DONNÉES — État local + synchro Firestore
//  Tout est stocké dans un seul document : tierlists/main
// ============================================================

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DOC_REF = doc(db, "tierlists", "main");

let state = null;                 // état courant en mémoire
const listeners = new Set();      // abonnés (re-render)
let saveTimer = null;             // anti-rebond pour la sauvegarde

// --- ID court et unique pour les nouveaux éléments
export function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// --- Lecture / abonnement ---------------------------------
export function getState() { return state; }
export function onState(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit() { listeners.forEach(cb => cb(state)); }

// Sérialisation des seuls champs "métier" (pour comparer / sauvegarder)
function meaningful(s) {
  return {
    branches: s.branches,
    ranks: s.ranks,
    professors: s.professors,
    placements: s.placements
  };
}

// ============================================================
//  DONNÉES DE TEST (profs fictifs en Mécatronique notamment)
//  Créées automatiquement au tout premier lancement.
// ============================================================
export const DEFAULT_DATA = {
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
  ],
  placements: {}   // profId -> rankId  (absent = dans la banque)
};

// ============================================================
//  INITIALISATION : crée le doc si absent, puis écoute en temps réel
// ============================================================
export async function initStore() {
  const snap = await getDoc(DOC_REF);
  if (!snap.exists()) {
    await setDoc(DOC_REF, { ...DEFAULT_DATA, updatedAt: serverTimestamp() });
  }

  onSnapshot(DOC_REF, (s) => {
    if (!s.exists()) return;
    const data = s.data();
    const incoming = {
      branches:   data.branches   || [],
      ranks:      data.ranks      || [],
      professors: data.professors || [],
      placements: data.placements || {}
    };
    // Ignore l'écho de notre propre écriture (évite de casser un drag en cours)
    if (state && JSON.stringify(meaningful(incoming)) === JSON.stringify(meaningful(state))) return;
    state = incoming;
    emit();
  });
}

// ============================================================
//  COMMIT : modifie l'état local puis programme la sauvegarde
//  mutator(draft) reçoit une copie modifiable de l'état.
// ============================================================
export function commit(mutator) {
  if (!state) return;
  const draft = structuredClone(state);
  mutator(draft);
  state = draft;
  emit();
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);   // sauvegarde automatique (débounce)
}

async function saveNow() {
  if (!state) return;
  try {
    await setDoc(DOC_REF, { ...meaningful(state), updatedAt: serverTimestamp() });
  } catch (e) {
    console.error("❌ Échec de la sauvegarde Firestore :", e);
  }
}
