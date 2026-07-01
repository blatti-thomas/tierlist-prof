// ============================================================
//  CATALOGUE PARTAGÉ — filières, orientations, branches canoniques
//  ------------------------------------------------------------
//  DÉCISION D'ARCHITECTURE (persistance) :
//  • On étend le stack existant (Firebase Auth + Firestore + GitHub
//    Pages) plutôt que d'introduire un serveur : pas d'infra à gérer,
//    cohérent avec le JS vanilla et l'hébergement statique actuel.
//  • Le catalogue vit dans UN document Firestore (catalog/main),
//    partagé et éditable par tout utilisateur connecté (petite
//    communauté de confiance — même modèle que les "Propositions").
//
//  MODÈLE DE DONNÉES :
//  • filieres : [{ id, name, orientations: [{ id, name }] }]
//  • subjects : branches CANONIQUES, indépendantes des filières
//               [{ id, name, aliases: [string] }]
//               → les noms de cours des boards perso ("Math Elec 2",
//                 "Math Tin 3", …) sont rattachés à leur branche
//                 canonique par correspondance nom/alias.
//  • links    : TABLE DE CORRESPONDANCE branche ↔ filière
//               [{ subjectId, filiereId }]
//               → une même branche (ex. "Mathématiques") reliée à
//                 plusieurs filières permet un classement AGRÉGÉ
//                 inter-filières.
// ============================================================

import { db } from "./firebase-config.js?v=14";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uid } from "./store.js?v=14";
import { escapeHtml, icon } from "./util.js?v=14";

export const norm = (s) => (s || "").trim().toLowerCase();

// ------------------------------------------------------------
//  ⚠️ DONNÉES DE DÉMARRAGE (DÉMO / PLACEHOLDER)
//  Les filières et correspondances ci-dessous sont des exemples à
//  adapter par la communauté (panneau "Ma tier list → Filières &
//  branches"). Seules les branches reprennent les cours déjà
//  présents dans le board par défaut du site.
// ------------------------------------------------------------
const SEED_CATALOG = {
  seed: true,
  filieres: [
    { id: "f_ge",   name: "Génie électrique (GE)", orientations: [
      { id: "o_ge_ai",  name: "Automatique industrielle (démo)" },
      { id: "o_ge_ee",  name: "Électronique embarquée (démo)" }
    ]},
    { id: "f_tin",  name: "Filière TIN (démo — à renommer)", orientations: [] },
    { id: "f_info", name: "Informatique (démo — à adapter)", orientations: [
      { id: "o_info_log", name: "Logiciel (démo)" }
    ]}
  ],
  subjects: [
    { id: "s_phys",   name: "Physique",                  aliases: ["physique 3"] },
    { id: "s_math",   name: "Mathématiques",             aliases: ["math elec 2", "math tin 3"] },
    { id: "s_syslog", name: "Systèmes logiques",         aliases: ["syslog1"] },
    { id: "s_electro",name: "Électronique",              aliases: ["electro 2"] },
    { id: "s_prog",   name: "Programmation",             aliases: ["python ge 2"] },
    { id: "s_mes",    name: "Techniques de mesure",      aliases: ["techmes"] },
    { id: "s_regul",  name: "Régulation automatique",    aliases: ["regul auto"] },
    { id: "s_puiss",  name: "Électronique de puissance", aliases: ["el puissan"] },
    { id: "s_meca",   name: "Mécatronique",              aliases: ["mecatro 1"] },
    { id: "s_sign",   name: "Signaux et systèmes",       aliases: ["signsys"] },
    { id: "s_gest",   name: "Gestion de projet",         aliases: [] }
  ],
  links: [
    // Démo : "Mathématiques" est partagée entre GE et TIN → agrégeable.
    { subjectId: "s_math",   filiereId: "f_ge" },
    { subjectId: "s_math",   filiereId: "f_tin" },
    { subjectId: "s_phys",   filiereId: "f_ge" },
    { subjectId: "s_phys",   filiereId: "f_tin" },
    { subjectId: "s_syslog", filiereId: "f_ge" },
    { subjectId: "s_electro",filiereId: "f_ge" },
    { subjectId: "s_prog",   filiereId: "f_ge" },
    { subjectId: "s_prog",   filiereId: "f_info" },
    { subjectId: "s_mes",    filiereId: "f_ge" },
    { subjectId: "s_regul",  filiereId: "f_ge" },
    { subjectId: "s_puiss",  filiereId: "f_ge" },
    { subjectId: "s_meca",   filiereId: "f_ge" },
    { subjectId: "s_sign",   filiereId: "f_ge" },
    { subjectId: "s_gest",   filiereId: "f_ge" },
    { subjectId: "s_gest",   filiereId: "f_tin" },
    { subjectId: "s_gest",   filiereId: "f_info" }
  ]
};

// ------------------------------------------------------------
//  CHARGEMENT / SAUVEGARDE (cache en mémoire)
// ------------------------------------------------------------
let catalog = null;
const catRef = () => doc(db, "catalog", "main");

export function getCatalog() { return catalog; }

export async function loadCatalog(force = false) {
  if (catalog && !force) return catalog;
  const snap = await getDoc(catRef());
  if (snap.exists()) {
    const d = snap.data();
    catalog = {
      filieres: d.filieres || [],
      subjects: d.subjects || [],
      links:    d.links    || []
    };
  } else {
    // Premier utilisateur : on initialise avec les données de démo.
    catalog = structuredClone(SEED_CATALOG);
    await setDoc(catRef(), { ...catalog, updatedAt: serverTimestamp() });
  }
  return catalog;
}

export async function saveCatalog(mutator) {
  if (!catalog) await loadCatalog();
  const draft = structuredClone(catalog);
  mutator(draft);
  catalog = draft;
  await setDoc(catRef(), {
    filieres: draft.filieres,
    subjects: draft.subjects,
    links:    draft.links,
    updatedAt: serverTimestamp()
  });
  return catalog;
}

// ------------------------------------------------------------
//  HELPERS DE CORRESPONDANCE
// ------------------------------------------------------------
export function filiereById(id) {
  return (catalog?.filieres || []).find(f => f.id === id) || null;
}

export function subjectById(id) {
  return (catalog?.subjects || []).find(s => s.id === id) || null;
}

// Branche canonique correspondant à un nom de cours d'un board perso
// (comparaison sur le nom canonique ET les alias, insensible à la casse).
export function subjectForBranchName(branchName) {
  const k = norm(branchName);
  if (!k) return null;
  return (catalog?.subjects || []).find(s =>
    norm(s.name) === k || (s.aliases || []).some(a => norm(a) === k)
  ) || null;
}

export function isSubjectInFiliere(subjectId, filiereId) {
  return (catalog?.links || []).some(l => l.subjectId === subjectId && l.filiereId === filiereId);
}

export function filieresOfSubject(subjectId) {
  const ids = (catalog?.links || []).filter(l => l.subjectId === subjectId).map(l => l.filiereId);
  return (catalog?.filieres || []).filter(f => ids.includes(f.id));
}

export function subjectsOfFiliere(filiereId) {
  const ids = (catalog?.links || []).filter(l => l.filiereId === filiereId).map(l => l.subjectId);
  return (catalog?.subjects || []).filter(s => ids.includes(s.id));
}

// ============================================================
//  ÉDITEUR DU CATALOGUE (section "Filières & branches" de la
//  modale "Ma tier list") — communautaire : modifie catalog/main.
// ============================================================

export function initCatalogAdmin() {
  document.getElementById("addFiliereBtn").onclick = async () => {
    const name = document.getElementById("newFiliereName").value.trim();
    if (!name) return;
    await saveCatalog(d => d.filieres.push({ id: uid("f"), name, orientations: [] }));
    document.getElementById("newFiliereName").value = "";
    renderCatalogAdmin();
  };

  document.getElementById("addSubjectBtn").onclick = async () => {
    const name = document.getElementById("newSubjectName").value.trim();
    if (!name) return;
    await saveCatalog(d => d.subjects.push({ id: uid("s"), name, aliases: [] }));
    document.getElementById("newSubjectName").value = "";
    renderCatalogAdmin();
  };
}

export async function renderCatalogAdmin() {
  await loadCatalog();
  renderFiliereAdmin();
  renderSubjectAdmin();
}

function renderFiliereAdmin() {
  const c = document.getElementById("adminFilieres");
  c.innerHTML = "";

  catalog.filieres.forEach(f => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = f.name;
    name.onchange = () => saveCatalog(d => {
      const t = d.filieres.find(x => x.id === f.id);
      if (t) t.name = name.value.trim();
    });

    // Les orientations s'éditent en liste séparée par des virgules
    const ori = document.createElement("input");
    ori.className = "ipt";
    ori.placeholder = "Orientations (séparées par des virgules)";
    ori.value = (f.orientations || []).map(o => o.name).join(", ");
    ori.onchange = () => saveCatalog(d => {
      const t = d.filieres.find(x => x.id === f.id);
      if (!t) return;
      const names = ori.value.split(",").map(s => s.trim()).filter(Boolean);
      // Conserve les ids des orientations dont le nom n'a pas changé
      t.orientations = names.map(n =>
        (t.orientations || []).find(o => o.name === n) || { id: uid("o"), name: n });
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.append(icon("delete"));
    del.onclick = async () => {
      await saveCatalog(d => {
        d.filieres = d.filieres.filter(x => x.id !== f.id);
        d.links = d.links.filter(l => l.filiereId !== f.id);
      });
      renderCatalogAdmin();
    };

    row.append(name, ori, del);
    c.appendChild(row);
  });
}

function renderSubjectAdmin() {
  const c = document.getElementById("adminSubjects");
  c.innerHTML = "";

  catalog.subjects.forEach(s => {
    const row = document.createElement("div");
    row.className = "admin-item admin-item-col";

    const line1 = document.createElement("div");
    line1.className = "cat-line";

    const name = document.createElement("input");
    name.className = "ipt";
    name.value = s.name;
    name.onchange = () => saveCatalog(d => {
      const t = d.subjects.find(x => x.id === s.id);
      if (t) t.name = name.value.trim();
    });

    const del = document.createElement("button");
    del.className = "btn btn-danger btn-sm";
    del.append(icon("delete"));
    del.onclick = async () => {
      await saveCatalog(d => {
        d.subjects = d.subjects.filter(x => x.id !== s.id);
        d.links = d.links.filter(l => l.subjectId !== s.id);
      });
      renderCatalogAdmin();
    };

    line1.append(name, del);

    const aliases = document.createElement("input");
    aliases.className = "ipt";
    aliases.placeholder = "Alias / noms de cours (séparés par des virgules)";
    aliases.value = (s.aliases || []).join(", ");
    aliases.onchange = () => saveCatalog(d => {
      const t = d.subjects.find(x => x.id === s.id);
      if (t) t.aliases = aliases.value.split(",").map(x => x.trim()).filter(Boolean);
    });

    // Table de correspondance branche ↔ filière : petits boutons à bascule
    const chips = document.createElement("div");
    chips.className = "cat-chips";
    catalog.filieres.forEach(f => {
      const chip = document.createElement("button");
      chip.type = "button";
      const active = isSubjectInFiliere(s.id, f.id);
      chip.className = "cat-chip" + (active ? " cat-chip-on" : "");
      chip.textContent = f.name;
      chip.title = active ? "Retirer de cette filière" : "Associer à cette filière";
      chip.onclick = async () => {
        await saveCatalog(d => {
          const i = d.links.findIndex(l => l.subjectId === s.id && l.filiereId === f.id);
          if (i >= 0) d.links.splice(i, 1);
          else d.links.push({ subjectId: s.id, filiereId: f.id });
        });
        renderCatalogAdmin();
      };
      chips.appendChild(chip);
    });

    row.append(line1, aliases, chips);
    c.appendChild(row);
  });
}
