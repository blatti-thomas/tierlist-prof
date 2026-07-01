// ============================================================
//  POINT D'ENTRÉE — Orchestration de l'application
// ============================================================

import { initStore, onState, getState, setDisplayName, setSaveListener } from "./store.js?v=17";
import { watchAuth, login, register, logout, setProfileName } from "./auth.js?v=17";
import { renderApp } from "./tierlist.js?v=17";
import { initAdmin, renderAdmin } from "./admin.js?v=17";
import { initGallery } from "./galerie.js?v=17";
import { initStats, setProfClickHandler } from "./stats.js?v=17";
import { initSuggestions } from "./propositions.js?v=17";
import { applyTheme } from "./theme.js?v=17";
import { loadCatalog } from "./catalog.js?v=17";
import {
  initProfile, getProfile, initOnboarding, openOnboarding, identityLabel, loadProfileStats
} from "./profile.js?v=17";
import { initComments, openProf } from "./comments.js?v=17";
import { initSocial, logBoardActivity, refreshFeedBadge } from "./social.js?v=17";
import { initGames } from "./games.js?v=17";

const loginScreen = document.getElementById("loginScreen");
const appScreen   = document.getElementById("appScreen");
const adminModal  = document.getElementById("adminModal");
const profileName = document.getElementById("profileName");

let storeReady = false;

function showApp()   { loginScreen.classList.add("hidden");  appScreen.classList.remove("hidden"); }
function showLogin() { appScreen.classList.add("hidden");    loginScreen.classList.remove("hidden"); }

// --- Re-render à chaque changement d'état
onState((state) => {
  if (state.board) applyTheme(state.board.theme);
  profileName.textContent = state.displayName || "Profil";
  renderApp();
  if (adminModal.classList.contains("open")) renderAdmin();
});

// --- Surveillance de la session
watchAuth(
  async (user) => {
    showApp();
    if (!storeReady) {
      await initStore(user);
      storeReady = true;
      // Profil (filière / orientation / follows) + catalogue partagé.
      // Première visite sans filière → onboarding.
      try {
        await loadCatalog();
        const profile = await initProfile(user, getState().displayName);
        if (!profile.filiereId) openOnboarding();
        refreshFeedBadge();
      } catch (e) {
        console.error("Profil / catalogue :", e);
      }
    }
  },
  () => {
    storeReady = false;
    showLogin();
  }
);

// --- Connexion / Inscription (e-mail + mot de passe)
const emailEl = document.getElementById("email");
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
  try {
    await register(emailEl.value.trim(), pwdEl.value);
  } catch (ex) {
    errEl.textContent = messageFor(ex);
    console.error("Inscription :", ex.code, ex.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => logout());

// --- Modale profil (changer son pseudo)
const profileModal  = document.getElementById("profileModal");
const profilePseudo = document.getElementById("profilePseudo");
const profileMsg    = document.getElementById("profileMsg");

document.getElementById("openProfileBtn").addEventListener("click", () => {
  profileMsg.textContent = "";
  profilePseudo.value = getState().displayName || "";
  document.getElementById("profileFiliere").textContent = identityLabel();
  renderProfileStats();
  profileModal.classList.add("open");
});

// Stats sociales du profil (abonnés, abonnements, réactions, note moyenne)
function renderProfileStats() {
  const box = document.getElementById("profileStats");
  box.innerHTML = `<p class="hint">Chargement des stats…</p>`;
  const cell = (num, lbl) =>
    `<div class="detail-cell"><span class="detail-num">${num}</span><span class="detail-lbl">${lbl}</span></div>`;
  loadProfileStats().then(s => {
    box.innerHTML =
      cell(s.followers, "abonné·e·s") +
      cell(s.following, "abonnements") +
      cell(s.likes, "réactions reçues") +
      cell(s.avg != null ? s.avg.toFixed(1) + "/5" : "—",
           s.votes ? `note moyenne (${s.votes} vote${s.votes > 1 ? "s" : ""})` : "note moyenne");
  }).catch(() => {
    box.innerHTML = `<p class="hint">Stats disponibles une fois les nouvelles règles Firestore publiées.</p>`;
  });
}

// Changer de filière / orientation depuis le profil
document.getElementById("changeFiliereBtn").addEventListener("click", () => {
  profileModal.classList.remove("open");
  openOnboarding();
});

initOnboarding(() => {
  // Rafraîchit l'étiquette si la modale profil est rouverte ensuite
  document.getElementById("profileFiliere").textContent = identityLabel();
});
document.getElementById("closeProfileBtn").addEventListener("click", () => {
  profileModal.classList.remove("open");
});
document.getElementById("saveProfileBtn").addEventListener("click", async () => {
  const name = profilePseudo.value.trim();
  if (!name) { profileMsg.textContent = "Entre un pseudo 😉"; return; }
  profileMsg.textContent = "Enregistrement…";
  try {
    await setDisplayName(name);
    await setProfileName(name);
    profileMsg.textContent = "Pseudo enregistré ✅";
  } catch (e) {
    console.error("Pseudo :", e);
    profileMsg.textContent = "Erreur : " + (e.code || e.message);
  }
});

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

// --- Branchements
initAdmin();
initGallery();
initStats();
initSuggestions();
initComments();
initSocial();
initGames();

// Clic sur une ligne des stats → fiche du prof (commentaires, réactions)
setProfClickHandler(openProf);
// Sauvegarde du board → événement dans le fil (throttlé à 1 / 10 min)
setSaveListener(logBoardActivity);
