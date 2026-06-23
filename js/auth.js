// ============================================================
//  AUTHENTIFICATION (Firebase Auth — Email/Mot de passe)
//  Inscription ouverte : chacun crée son propre compte.
// ============================================================

import { auth } from "./firebase-config.js?v=6";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function watchAuth(onLoggedIn, onLoggedOut) {
  onAuthStateChanged(auth, (user) => user ? onLoggedIn(user) : onLoggedOut());
}

export async function register(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

// Met à jour le pseudo dans le profil Firebase Auth (pour les prochaines connexions).
export function setProfileName(name) {
  return auth.currentUser
    ? updateProfile(auth.currentUser, { displayName: name })
    : Promise.resolve();
}
