// ============================================================
//  POINT D'ENTRÉE — Orchestration de l'application
// ============================================================

import { initStore, onState } from "./store.js";
import { watchAuth, login, logout } from "./auth.js";
import { renderApp } from "./tierlist.js";
import { initAdmin, renderAdmin } from "./admin.js";

const loginScreen = document.getElementById("loginScreen");
const appScreen   = document.getElementById("appScreen");
const adminModal  = document.getElementById("adminModal");

let storeReady = false;

function showApp()   { loginScreen.classList.add("hidden");  appScreen.classList.remove("hidden"); }
function showLogin() { appScreen.classList.add("hidden");    loginScreen.classList.remove("hidden"); }

// --- Re-render à chaque changement d'état (local OU temps réel Firestore)
onState(() => {
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
    err.textContent = "Mot de passe incorrect ❌";
    console.error(ex);
  }
});

// --- Déconnexion
document.getElementById("logoutBtn").addEventListener("click", () => logout());

// --- Branchements du panneau admin
initAdmin();
