// ============================================================
//  CONFIGURATION FIREBASE
//  ⚠️  Remplace l'objet firebaseConfig ci-dessous par le TIEN.
//      Console Firebase → ⚙️ Paramètres du projet → "Tes applications"
//      → icône Web </> → copie l'objet const firebaseConfig = {...}
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyApXtccwVe81QR_V23pSNsxnpTyYWw0doY",
  authDomain: "tierlist-prof.firebaseapp.com",
  projectId: "tierlist-prof",
  storageBucket: "tierlist-prof.firebasestorage.app",
  messagingSenderId: "112887063766",
  appId: "1:112887063766:web:0f2982c6c50ae7cc581577",
  measurementId: "G-KTRXRPT797"
};

// ------------------------------------------------------------
//  Compte d'accès partagé.
//  Sur la page de connexion, l'utilisateur ne tape QUE le mot de passe ;
//  l'app se connecte automatiquement avec cet e-mail.
//  → Crée ce compte dans Firebase : Authentication → Users → "Add user".
// ------------------------------------------------------------
export const APP_ACCESS_EMAIL = "thomas.2048.blatti@gmail.com";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
