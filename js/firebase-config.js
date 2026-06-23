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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
