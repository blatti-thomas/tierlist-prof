// ============================================================
//  MIGRATION (à lancer une seule fois, en admin)
//  Copie config/main + rankings/{uid}  ->  boards/{uid}
// ============================================================

import { auth, db } from "./firebase-config.js?v=15";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, getDocs, getDoc, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { DEFAULT_BOARD } from "./store.js?v=15";

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const btn = document.getElementById("migrateBtn");

function log(m) { logEl.textContent += m + "\n"; }

function tiersFromPlacements(p) {
  const t = {};
  Object.entries(p || {}).forEach(([id, r]) => { (t[r] = t[r] || []).push(id); });
  return t;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    statusEl.textContent = "✅ Connecté : " + user.email + " — prêt à migrer.";
    btn.disabled = false;
  } else {
    statusEl.textContent = "⚠️ Non connecté. Connecte-toi d'abord sur le site principal (même navigateur), puis recharge cette page.";
    btn.disabled = true;
  }
});

btn.onclick = async () => {
  btn.disabled = true;
  logEl.textContent = "";

  // 1) Ancienne config partagée (profs/branches/rangs/thème)
  log("Lecture de l'ancienne config…");
  let cfg = {};
  try {
    const s = await getDoc(doc(db, "config", "main"));
    if (s.exists()) cfg = s.data();
  } catch (e) { log("⚠️ config/main illisible (" + e.code + ") — on utilise les profs par défaut."); }

  const branches   = cfg.branches   || DEFAULT_BOARD.branches;
  const ranks      = cfg.ranks      || DEFAULT_BOARD.ranks;
  const professors = cfg.professors || DEFAULT_BOARD.professors;
  const theme      = cfg.theme      || DEFAULT_BOARD.theme;

  // 2) Tous les anciens classements
  log("Lecture des anciens classements…");
  let snap;
  try {
    snap = await getDocs(collection(db, "rankings"));
  } catch (e) {
    log("❌ Lecture 'rankings' refusée (" + e.code + ").");
    log("   → As-tu publié les RÈGLES TEMPORAIRES et es-tu connecté en admin ?");
    btn.disabled = false;
    return;
  }

  // 3) Écriture des boards
  let n = 0;
  for (const r of snap.docs) {
    const data = r.data();
    const tiers = data.tiers || tiersFromPlacements(data.placements);
    try {
      await setDoc(doc(db, "boards", r.id), {
        displayName: data.displayName || r.id,
        theme, branches, ranks, professors, tiers,
        updatedAt: serverTimestamp()
      });
      n++;
      log("✓ " + (data.displayName || r.id));
    } catch (e) {
      log("❌ " + r.id + " : " + e.code);
    }
  }

  log("\n🎉 Terminé : " + n + " tier list(s) restaurée(s).");
  log("👉 Tu peux maintenant republier les RÈGLES SÉCURISÉES (boards uniquement).");
};
