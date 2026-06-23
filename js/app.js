// ============================================================
//  POINT D'ENTRÉE — Orchestration de l'application
// ============================================================

import { initStore, onState, getState } from "./store.js";
import { watchAuth, login, register, logout, isAdmin } from "./auth.js";
import { renderApp } from "./tierlist.js";
import { initAdmin, renderAdmin } from "./admin.js";
import { applyTheme } from "./theme.js";

const loginScreen = document.getElementById("loginScreen");
const appScreen   = document.getElementById("appScreen");
const adminModal  = document.getElementById("adminModal");
const adminBtn    = document.getElementById("openAdminBtn");

let storeReady = false;

function showApp()   { loginScreen.classList.add("hidden");  appScreen.classList.remove("hidden"); }
function showLogin() { appScreen.classList.add("hidden");    loginScreen.classList.remove("hidden"); }

// --- Re-render à chaque changement d'état
onState((state) => {
  if (state.config) applyTheme(state.config.theme);
  renderApp();
  if (adminModal.classList.contains("open")) renderAdmin();
});

// --- Surveillance de la session
watchAuth(
  async (user) => {
    const admin = isAdmin(user);
    adminBtn.classList.toggle("hidden", !admin);  // bouton Admin réservé à l'admin
    showApp();
    if (!storeReady) {
      await initStore(user, admin);
      storeReady = true;
    }
  },
  () => {
    storeReady = false;
    showLogin();
  }
);

// --- Connexion / Inscription
const emailEl = document.getElementById("email");
const nameEl  = document.getElementById("displayName");
const pwdEl   = document.getElementById("password");
const errEl   = document.getElementById("loginError");

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.textContent = "";
  try {
    await login(emailEl.value.trim(), pwdEl.value);
  } catch (ex) {
    errEl.textContent = messageFor(ex);
    console.error("Connexion :", ex.code, ex.message);
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  errEl.textContent = "";
  const name = nameEl.value.trim();
  if (!name) { errEl.textContent = "Choisis un pseudo pour créer ton compte 😉"; return; }
  try {
    await register(emailEl.value.trim(), pwdEl.value, name);
  } catch (ex) {
    errEl.textContent = messageFor(ex);
    console.error("Inscription :", ex.code, ex.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => logout());

// Traduit les codes d'erreur Firebase en messages clairs
function messageFor(ex) {
  switch (ex.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou mot de passe incorrect ❌";
    case "auth/email-already-in-use":
      return "Cet e-mail a déjà un compte → connecte-toi 🙂";
    case "auth/weak-password":
      return "Mot de passe trop court (min. 6 caractères) ⚠️";
    case "auth/invalid-email":
      return "E-mail invalide ❌";
    case "auth/missing-password":
      return "Entre un mot de passe ⚠️";
    case "auth/operation-not-allowed":
      return "Active « E-mail/Mot de passe » dans Firebase Auth ⚠️";
    case "auth/unauthorized-domain":
      return "Domaine non autorisé (Firebase → Auth → Settings) ⚠️";
    case "auth/network-request-failed":
      return "Problème de réseau 📡";
    default:
      return "Erreur : " + (ex.code || ex.message);
  }
}

// --- Branchements du panneau admin
initAdmin();
