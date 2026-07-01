# 🎓 Tier List des Profs

Une petite application web (100 % front-end) pour faire, **entre potes**, des *tier lists* de
profs façon « S / A / B / C / D ». Chacun se crée un compte, classe les profs en glisser-déposer,
personnalise ses catégories et son thème, et peut voir les classements des autres dans une galerie.

> Projet perso fait pour s'amuser et apprendre (HTML/CSS/JS + Firebase + GitHub Pages).

---

## ⚠️ Disclaimer (à lire avant de rigoler)

Ce site est un **projet à but purement humoristique et récréatif**, créé pour s'amuser entre
camarades. Les classements n'ont **aucune valeur officielle**, n'expriment **aucun jugement
sérieux** sur les compétences ou la personne des enseignant·e·s, et ne reflètent que des
**opinions subjectives et bon enfant**.

- Ce n'est **ni une évaluation**, ni un avis officiel, ni un outil affilié à un établissement.
- Je **déplore et désapprouve formellement tout débordement** : insultes, harcèlement, propos
  diffamatoires, moqueries déplacées ou toute utilisation malveillante. Ce n'est **pas** l'esprit
  du projet.
- En cas de demande légitime d'une personne concernée, le contenu peut être **retiré sans délai**.

Bref : **c'est pour rire, on reste respectueux.** 🙏

---

## ✨ Fonctionnalités

- 🔐 Comptes individuels (e-mail + mot de passe)
- 🧲 Tier list en glisser-déposer (PC **et** mobile), avec ordre précis dans chaque rang
- 🛠️ Panneau perso : ajouter/modifier profs, cours et catégories, changer les couleurs
- 🎨 Personnalisation de l'apparence (police, taille, couleurs, arrondis)
- 🌍 Galerie : voir les tier lists de tout le monde
- 📊 Statistiques : les profs les mieux classés (score normalisé, indépendant du nombre de catégories)
- 📥 Propositions : importer les profs/cours/catégories ajoutés par les autres, sans doublons
- 👤 Pseudo modifiable à tout moment
- 🎓 Filière & orientation : choisies à la première connexion (persistées dans le compte),
  les stats sont filtrées pour ton cursus
- 🔗 Branches canoniques : un même cours enseigné dans plusieurs filières (ex. « Mathématiques »)
  est **agrégeable** entre elles via un catalogue partagé (table de correspondance branche ↔ filière)
- 💬 Commentaires & réactions emoji sur chaque prof (fiche accessible depuis les stats),
  avec anti-spam côté serveur (1 commentaire / 15 s, imposé par les règles Firestore)
- 👥 Follow : suis d'autres utilisateurs et retrouve leur activité (tier lists, avis, parties)
  dans le fil, avec badge de nouveautés
- 🎮 Mini-jeux (« Qui enseigne ce cours ? », « Le verdict de la commu ») avec leaderboard dédié,
  distinct du classement des profs

---

## 🧰 Stack technique

- **Front-end** : HTML, CSS, JavaScript modulaire (ES modules), icônes Material Symbols
- **Back-end** : [Firebase](https://firebase.google.com/) — Authentication + Cloud Firestore
- **Hébergement** : GitHub Pages (site statique)

---

## 🚀 Déployer ta propre version

1. Crée un projet sur la [console Firebase](https://console.firebase.google.com).
2. Active **Authentication → E-mail/Mot de passe**.
3. Crée une base **Cloud Firestore** (mode production).
4. Copie tes règles depuis [`firestore.rules`](firestore.rules) → onglet *Rules* → **Publier**.
5. Récupère ton objet `firebaseConfig` (⚙️ *Paramètres du projet → Tes applications → Web*).
6. Colle-le dans [`js/firebase-config.js`](js/firebase-config.js).
7. Pousse le tout sur un dépôt GitHub → *Settings → Pages → Deploy from a branch* (`main` / `root`).
8. Dans Firebase → *Authentication → Settings → Authorized domains*, ajoute ton domaine `…github.io`.

> 💡 **À propos de `firebaseConfig`** : ces clés sont **publiques par conception** dans toute app web
> Firebase (elles identifient le projet, ce ne sont pas des secrets). Ce qui protège réellement les
> données, ce sont les **règles Firestore** (qui exigent d'être connecté). N'y mets donc aucune
> donnée sensible.

---

## 📁 Structure

```
index.html              page unique (connexion + app + modales)
css/style.css           styles (thème "cartoon")
js/
  firebase-config.js    config Firebase (à remplacer par la tienne)
  store.js              état + Firestore (1 board par utilisateur)
  auth.js               connexion / inscription
  tierlist.js           rendu + glisser-déposer
  admin.js              éditeur de son board
  theme.js              personnalisation de l'apparence
  galerie.js            galerie commune + boutons "Suivre"
  stats.js              statistiques (filtres filière/branche + agrégation)
  propositions.js       import des ajouts des autres
  catalog.js            catalogue partagé : filières, branches canoniques, correspondances
  profile.js            profil users/{uid} : filière, orientation, follows + onboarding
  comments.js           fiche prof : commentaires + réactions emoji
  social.js             follow, fil d'activité, badge de nouveautés
  games.js              mini-jeux + leaderboard
  app.js                point d'entrée
firestore.rules         règles de sécurité Firestore
```

### 🗃️ Collections Firestore

| Collection        | Contenu                                                        | Lecture   | Écriture |
|-------------------|----------------------------------------------------------------|-----------|----------|
| `boards/{uid}`    | tier list complète d'un utilisateur                            | connectés | propriétaire |
| `users/{uid}`     | profil léger : pseudo, filière, orientation, follows           | connectés | propriétaire |
| `catalog/main`    | filières/orientations + branches canoniques + correspondances  | connectés | connectés (communautaire) |
| `comments/{id}`   | commentaires sur un prof (+ réactions)                         | connectés | auteur (réactions : tous) |
| `reactions/{key}` | réactions rapides sur un prof ou une tier list                 | connectés | connectés |
| `ratings/{uid}`   | notes 1–5 sur la tier list d'un utilisateur (1 champ/votant)   | connectés | votant (son champ uniquement) |
| `activity/{id}`   | fil d'activité (append-only)                                   | connectés | auteur, sans modif/suppr. |
| `scores/{uid}`    | leaderboard des mini-jeux                                      | connectés | propriétaire |

> ⚠️ **Après mise à jour du code, republie les règles** ([`firestore.rules`](firestore.rules)) dans
> la console Firebase, sinon les nouvelles fonctionnalités (filières, commentaires, fil, scores)
> répondent `permission-denied`. La tier list de base continue de fonctionner en attendant.

---

## 📄 Licence

Projet personnel, fourni « tel quel », à but éducatif et récréatif.
