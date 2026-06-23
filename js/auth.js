// ============================================================
//  AUTHENTIFICATION (Firebase Auth — Email/Mot de passe)
//  L'utilisateur ne saisit que le mot de passe : l'e-mail est fixe.
// ============================================================

import { auth, APP_ACCESS_EMAIL } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function watchAuth(onLoggedIn, onLoggedOut) {
  onAuthStateChanged(auth, (user) => user ? onLoggedIn(user) : onLoggedOut());
}

export function login(password) {
  return signInWithEmailAndPassword(auth, APP_ACCESS_EMAIL, password);
}

export function logout() {
  return signOut(auth);
}
