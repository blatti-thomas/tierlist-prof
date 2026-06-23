# 🎓 Tier List des Profs

Application web statique (HTML/CSS/JS) pour créer une **tier list paramétrable** de professeurs,
au style **cartoon**, avec connexion par mot de passe, drag & drop, et sauvegarde temps réel
sur **Firebase / Cloud Firestore**. Hébergeable gratuitement sur **GitHub Pages**.

## ✨ Fonctionnalités
- 🔒 Page de connexion par mot de passe (Firebase Auth)
- 🧲 Glisser-déposer des profs depuis une "banque" vers les rangs (PC **et** mobile)
- ⚙️ Panneau d'admin : ajout/modif/suppression des profs, branches et rangs (label, couleur, ordre)
- ☁️ Sauvegarde automatique + synchro temps réel entre appareils
- 🎨 Design cartoon responsive

---

## 1) Configurer Firebase (étape par étape)

1. Va sur **https://console.firebase.google.com** → **Ajouter un projet** → donne un nom → crée-le.
2. **Authentication** : menu de gauche → *Authentication* → *Get started* →
   onglet *Sign-in method* → active **E-mail/Mot de passe** → *Enregistrer*.
3. **Crée le compte d'accès** : onglet *Users* → *Add user* →
   - E-mail : `thomas.2048.blatti@gmail.com` (le même que `APP_ACCESS_EMAIL` dans `js/firebase-config.js`)
   - Mot de passe : celui que tu taperas sur la page de connexion → *Add user*.
4. **Firestore** : menu de gauche → *Firestore Database* → *Create database* →
   choisis un emplacement (ex. `eur3`) → démarre en mode **production**.
5. **Règles de sécurité** : onglet *Rules* → colle le contenu de `firestore.rules` → *Publier*.
6. **Récupère ta config** : ⚙️ *Paramètres du projet* → section *Tes applications* →
   icône **Web `</>`** → enregistre l'app → copie l'objet `firebaseConfig = { ... }`.
7. Colle cet objet dans **`js/firebase-config.js`** (remplace les `VOTRE_...`).

> Au tout premier lancement, l'app crée automatiquement le document `tierlists/main`
> avec des **profs de test en Mécatronique**.

---

## 2) Tester en local

> Les modules ES (`import`) ne fonctionnent pas en `file://` : il faut un petit serveur.

```bash
# Python
python -m http.server 5500
# ou Node
npx serve
```
Puis ouvre `http://localhost:5500`.

---

## 3) Déployer sur GitHub Pages

1. Crée un dépôt GitHub et pousse tout le contenu de ce dossier.
2. Dépôt → *Settings* → *Pages* → *Build and deployment* → Source : **Deploy from a branch** →
   Branche : `main` / dossier `/ (root)` → *Save*.
3. Ton site sera dispo sur `https://<utilisateur>.github.io/<repo>/`.
4. Dans Firebase → *Authentication* → *Settings* → *Authorized domains* →
   ajoute ton domaine `…github.io`.

---

## 📁 Structure

```
Tierlist-prof/
├─ index.html
├─ css/style.css
├─ js/
│  ├─ firebase-config.js   ← ⚠️ ta config Firebase ici
│  ├─ store.js             ← état + synchro Firestore + données de test
│  ├─ auth.js              ← connexion / déconnexion
│  ├─ tierlist.js          ← rendu + drag & drop
│  ├─ admin.js             ← panneau d'administration (CRUD)
│  ├─ util.js
│  └─ app.js               ← point d'entrée
├─ firestore.rules         ← règles de sécurité à copier dans Firebase
└─ README.md
```
