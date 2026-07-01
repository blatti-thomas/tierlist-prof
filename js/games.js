// ============================================================
//  MINI-JEUX + LEADERBOARD DE RÉTENTION
//  ------------------------------------------------------------
//  CHOIX DES JEUX (simples, et surtout basés UNIQUEMENT sur les
//  données déjà présentes dans les boards — aucune donnée inventée) :
//  1. "Qui enseigne ce cours ?" — retrouver le prof d'un cours parmi
//     4 propositions. Les paires prof↔cours viennent des boards de la
//     communauté → le contenu du jeu grandit tout seul avec le site.
//  2. "Le verdict de la commu" — deviner dans quelle catégorie
//     (S…D) la communauté classe en moyenne un prof. Rejoue l'onglet
//     Stats sous forme de quiz → incite à revenir voir l'évolution.
//
//  LEADERBOARD : scores/{uid} = { name, best, total, games, updatedAt }
//  — distinct du classement des profs. "best" = meilleur run,
//  "total" = points cumulés (récompense la régularité → rétention).
//  Limite assumée : le score est écrit par le client (pas de serveur) ;
//  les règles Firestore ne peuvent que vérifier le type/propriétaire.
// ============================================================

import { db } from "./firebase-config.js?v=14";
import {
  doc, getDoc, setDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getState, loadAllBoards } from "./store.js?v=14";
import { computeStats } from "./stats.js?v=14";
import { escapeHtml } from "./util.js?v=14";
import { norm } from "./catalog.js?v=14";
import { logActivity } from "./social.js?v=14";

const QUESTIONS_PER_RUN = 8;
const POINTS_PER_GOOD = 10;
const STREAK_BONUS = 5;         // à partir de 3 bonnes réponses d'affilée
const VERDICT_LABELS = ["S", "A", "B", "C", "D"];

let boards = [];
let game = null;   // { title, questions, index, score, streak }

export function initGames() {
  document.getElementById("openGamesBtn").onclick = openGames;
  document.getElementById("closeGamesBtn").onclick = () =>
    document.getElementById("gamesModal").classList.remove("open");

  document.querySelectorAll("#gamesTabs .tab").forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
}

function activateTab(name) {
  document.querySelectorAll("#gamesTabs .tab").forEach(b =>
    b.classList.toggle("tab-active", b.dataset.tab === name));
  document.querySelectorAll("#gamesModal .tab-panel").forEach(p =>
    p.classList.toggle("tab-panel-active", p.dataset.panel === name));
  if (name === "scores") renderLeaderboard();
}

async function openGames() {
  document.getElementById("gamesModal").classList.add("open");
  activateTab("jouer");
  const area = document.getElementById("gameArea");
  area.innerHTML = `<p class="hint">Chargement des données…</p>`;
  try {
    boards = await loadAllBoards();
    renderMenu();
  } catch (e) {
    area.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

// ------------------------------------------------------------
//  MENU : choix du jeu
// ------------------------------------------------------------
function renderMenu() {
  const area = document.getElementById("gameArea");
  area.innerHTML = "";

  const teach = buildTeachQuestions();
  const verdict = buildVerdictQuestions();

  area.appendChild(gameCard(
    "school", "Qui enseigne ce cours ?",
    "Retrouve le bon prof parmi 4 propositions. Les questions viennent des tier lists de tout le monde.",
    teach.length >= 3 ? () => startGame("Qui enseigne ce cours ?", teach) : null,
    teach.length < 3 ? "Pas encore assez de profs/cours pour jouer." : ""
  ));

  area.appendChild(gameCard(
    "how_to_vote", "Le verdict de la commu",
    "Devine dans quelle catégorie (S → D) la communauté classe ce prof en moyenne.",
    verdict.length >= 3 ? () => startGame("Le verdict de la commu", verdict) : null,
    verdict.length < 3 ? "Il faut plus de votes (profs classés par ≥ 2 personnes)." : ""
  ));
}

function gameCard(iconName, title, desc, onPlay, disabledMsg) {
  const card = document.createElement("div");
  card.className = "game-card";
  card.innerHTML =
    `<span class="material-symbols-rounded game-icon">${iconName}</span>` +
    `<div class="game-info"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p>` +
    (disabledMsg ? `<p class="hint">${escapeHtml(disabledMsg)}</p>` : "") + `</div>`;
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.innerHTML = `<span class="material-symbols-rounded">play_arrow</span> Jouer`;
  btn.disabled = !onPlay;
  if (onPlay) btn.onclick = onPlay;
  card.appendChild(btn);
  return card;
}

// ------------------------------------------------------------
//  GÉNÉRATION DES QUESTIONS (à partir des boards existants)
// ------------------------------------------------------------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Jeu 1 : cours → prof. Agrège les paires prof↔cours de tous les boards.
function buildTeachQuestions() {
  const byCourse = new Map();   // norm(cours) -> { label, profs:Set }
  const allProfs = new Set();

  boards.forEach(b => {
    const branches = b.branches || [];
    (b.professors || []).forEach(p => {
      if (!p.name) return;
      allProfs.add(p.name.trim());
      const br = branches.find(x => x.id === p.branchId);
      if (!br || !br.name) return;
      const k = norm(br.name);
      const e = byCourse.get(k) || { label: br.name.trim(), profs: new Set() };
      e.profs.add(p.name.trim());
      byCourse.set(k, e);
    });
  });

  if (allProfs.size < 4) return [];

  const questions = [];
  byCourse.forEach(course => {
    const correct = shuffle([...course.profs])[0];
    const distractors = shuffle([...allProfs].filter(n => !course.profs.has(n))).slice(0, 3);
    if (distractors.length < 3) return;
    questions.push({
      text: `Qui enseigne « ${course.label} » ?`,
      options: shuffle([correct, ...distractors]),
      answer: correct,
      explain: `${correct} est associé·e à « ${course.label} » sur les tier lists.`
    });
  });

  return shuffle(questions).slice(0, QUESTIONS_PER_RUN);
}

// Jeu 2 : prof → catégorie moyenne de la communauté (S…D).
function buildVerdictQuestions() {
  const stats = computeStats(boards).filter(e => e.count >= 2);
  return shuffle(stats).slice(0, QUESTIONS_PER_RUN).map(e => {
    // Score 1 → S (index 0), score 0 → D (index 4)
    const idx = Math.min(4, Math.max(0, Math.round((1 - e.score) * 4)));
    return {
      text: `Dans quelle catégorie la communauté classe-t-elle « ${e.name} » en moyenne ?`,
      options: VERDICT_LABELS,
      answer: VERDICT_LABELS[idx],
      explain: `Score pondéré de ${Math.round(e.score * 100)} % (${e.count} vote${e.count > 1 ? "s" : ""}) → ${VERDICT_LABELS[idx]}.`
    };
  });
}

// ------------------------------------------------------------
//  DÉROULEMENT D'UNE PARTIE
// ------------------------------------------------------------
function startGame(title, questions) {
  game = { title, questions, index: 0, score: 0, streak: 0 };
  renderQuestion();
}

function renderQuestion() {
  const area = document.getElementById("gameArea");
  const q = game.questions[game.index];
  area.innerHTML = "";

  const head = document.createElement("div");
  head.className = "quiz-head";
  head.innerHTML =
    `<span>${escapeHtml(game.title)} — question ${game.index + 1}/${game.questions.length}</span>` +
    `<span class="quiz-score">${game.score} pts</span>`;

  const text = document.createElement("p");
  text.className = "quiz-question";
  text.textContent = q.text;

  const grid = document.createElement("div");
  grid.className = "quiz-options";

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn quiz-option";
    btn.textContent = opt;
    btn.onclick = () => answer(opt, grid, q);
    grid.appendChild(btn);
  });

  area.append(head, text, grid);
}

function answer(chosen, grid, q) {
  const good = chosen === q.answer;
  if (good) {
    game.streak += 1;
    game.score += POINTS_PER_GOOD + (game.streak >= 3 ? STREAK_BONUS : 0);
  } else {
    game.streak = 0;
  }

  // Fige les boutons + colorie la bonne (verte) et l'erreur (rouge)
  [...grid.children].forEach(b => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add("quiz-good");
    else if (b.textContent === chosen) b.classList.add("quiz-bad");
  });

  const area = document.getElementById("gameArea");
  const fb = document.createElement("p");
  fb.className = "quiz-feedback " + (good ? "quiz-fb-good" : "quiz-fb-bad");
  fb.textContent = (good
    ? `✔ Bonne réponse ! +${POINTS_PER_GOOD + (game.streak >= 3 ? STREAK_BONUS : 0)} pts`
      + (game.streak >= 3 ? ` (série de ${game.streak} 🔥)` : "")
    : "✘ Raté… ") + " " + q.explain;

  const next = document.createElement("button");
  next.className = "btn btn-accent";
  const last = game.index + 1 >= game.questions.length;
  next.innerHTML = `<span class="material-symbols-rounded">${last ? "flag" : "arrow_forward"}</span> ${last ? "Terminer" : "Suivant"}`;
  next.onclick = () => {
    game.index += 1;
    game.index >= game.questions.length ? endGame() : renderQuestion();
  };

  area.append(fb, next);
}

async function endGame() {
  const area = document.getElementById("gameArea");
  const total = game.questions.length * POINTS_PER_GOOD;
  area.innerHTML =
    `<div class="quiz-end">` +
      `<span class="material-symbols-rounded quiz-end-icon">emoji_events</span>` +
      `<h3>Partie terminée !</h3>` +
      `<p class="quiz-end-score">${game.score} points</p>` +
      `<p class="hint">(maximum ${total} pts hors bonus de série)</p>` +
    `</div>`;

  const row = document.createElement("div");
  row.className = "quiz-end-actions";

  const again = document.createElement("button");
  again.className = "btn btn-primary";
  again.innerHTML = `<span class="material-symbols-rounded">replay</span> Rejouer`;
  again.onclick = renderMenu;

  const board = document.createElement("button");
  board.className = "btn btn-accent";
  board.innerHTML = `<span class="material-symbols-rounded">leaderboard</span> Classement`;
  board.onclick = () => activateTab("scores");

  row.append(again, board);
  area.appendChild(row);

  try {
    await saveScore(game.score);
    logActivity("game", `a marqué ${game.score} pts à « ${game.title} »`);
  } catch (e) {
    console.error("Score :", e);
    area.insertAdjacentHTML("beforeend",
      `<p class="login-error">Score non enregistré : ${escapeHtml(e.code || e.message)}</p>`);
  }
}

// ------------------------------------------------------------
//  SCORES / LEADERBOARD (collection scores, distincte des profs)
// ------------------------------------------------------------
async function saveScore(runScore) {
  const { uid, displayName } = getState();
  const ref = doc(db, "scores", uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : { best: 0, total: 0, games: 0 };
  await setDoc(ref, {
    name: displayName || "Quelqu'un",
    best: Math.max(prev.best || 0, runScore),
    total: (prev.total || 0) + runScore,
    games: (prev.games || 0) + 1,
    updatedAt: serverTimestamp()
  });
}

async function renderLeaderboard() {
  const box = document.getElementById("gamesBoard");
  box.innerHTML = `<p class="hint">Chargement du classement…</p>`;
  try {
    const qs = await getDocs(collection(db, "scores"));
    const list = [];
    qs.forEach(d => list.push({ uid: d.id, ...d.data() }));
    list.sort((a, b) => (b.best || 0) - (a.best || 0) || (b.total || 0) - (a.total || 0));

    if (!list.length) {
      box.innerHTML = `<p class="hint">Personne n'a encore joué — sois le premier ou la première !</p>`;
      return;
    }

    const { uid: myUid } = getState();
    box.innerHTML = "";
    list.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "stat-row" + (s.uid === myUid ? " score-me" : "");

      const pos = document.createElement("div");
      pos.className = "stat-pos";
      if (i === 0)      pos.innerHTML = `<span class="material-symbols-rounded gold">trophy</span>`;
      else if (i < 3)   pos.innerHTML = `<span class="material-symbols-rounded ${i === 1 ? "silver" : "bronze"}">workspace_premium</span>`;
      else              pos.textContent = i + 1;

      const main = document.createElement("div");
      main.className = "stat-main";
      const name = document.createElement("div");
      name.className = "stat-name";
      name.textContent = (s.name || "Quelqu'un") + (s.uid === myUid ? " (toi)" : "");
      const meta = document.createElement("div");
      meta.className = "stat-meta";
      meta.textContent = `record ${s.best || 0} pts · ${s.total || 0} pts cumulés · ${s.games || 0} partie${(s.games || 0) > 1 ? "s" : ""}`;
      main.append(name, meta);

      row.append(pos, main);
      box.appendChild(row);
    });
  } catch (e) {
    box.innerHTML = `<p class="login-error">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
