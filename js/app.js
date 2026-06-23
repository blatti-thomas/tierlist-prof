// ============================================================
//  POINT D'ENTRÉE — Orchestration de l'application
// ============================================================

import { initStore, onState } from "./store.js";
import { watchAuth, login, logout } from "./auth.js";
import { renderApp } from "./tierlist.js";
import { initAdmin, renderAdmin } from "./admin.js";
import { applyTheme } from "./theme.js";

const loginScreen = document.getElementById("loginScreen");
const appScreen   = document.getElementById("appScreen");
const adminModal  = document.getElementById("adminModal");

let storeReady = false;

function showApp()   { loginScreen.classList.add("hidden");  appScreen.classList.remove("hidden"); }
function showLogin() { appScreen.classList.add("hidden");    loginScreen.classList.remove("hidden"); }

// --- Re-render à chaque changement d'état (local OU temps réel Firestore)
onState((state) => {
  if (state) applyTheme(state.theme);
  renderApp();
  if (adminModal.classList.contains("open")) renderAdmin();
});

// --- Surveillance de la session
watchAuth(
  async () => {
    showApp();
    if (!storeReady) {
      await initStore();   // charge / crée le doc + écoute en temps réel
      storeReady = true;
    }
  },
  () => showLogin()
);

// --- Connexion
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pwd = document.getElementById("password").value;
  const err = document.getElementById("loginError");
  err.textContent = "";
  try {
    await login(pwd);
    document.getElementById("password").value = "";
  } catch (ex) {
    err.textContent = messageFor(ex);
    console.error("Erreur de connexion :", ex.code, ex.message);
  }
});

// Traduit le code d'erreur Firebase en message clair
function messageFor(ex) {
  switch (ex.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Mot de passe incorrect ❌";
    case "auth/invalid-email":
      return "E-mail d'accès invalide (vérifie firebase-config.js) ❌";
    case "auth/operation-not-allowed":
      return "Active « E-mail/Mot de passe » dans Firebase Auth ⚠️";
    case "auth/unauthorized-domain":
      return "Domaine non autorisé : ajoute-le dans Firebase → Auth → Settings ⚠️";
    case "auth/network-request-failed":
      return "Problème de réseau 📡";
    default:
      return "Erreur : " + (ex.code || ex.message);
  }
}

// --- Déconnexion
document.getElementById("logoutBtn").addEventListener("click", () => logout());

// --- Branchements du panneau admin
initAdmin();
