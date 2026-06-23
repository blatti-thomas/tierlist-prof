// ============================================================
//  THÈME / APPARENCE
//  Applique les variables CSS et gère les contrôles de l'admin.
// ============================================================

import { commitBoard, DEFAULT_THEME } from "./store.js?v=5";

// Polices proposées (clé = nom affiché, valeur = nom pour Google Fonts)
export const FONTS = {
  "Fredoka": "Fredoka",
  "Baloo 2": "Baloo+2",
  "Poppins": "Poppins",
  "Nunito": "Nunito",
  "Quicksand": "Quicksand",
  "Comic Neue": "Comic+Neue",
  "Patrick Hand": "Patrick+Hand",
  "Luckiest Guy": "Luckiest+Guy"
};

const loaded = new Set(["Fredoka"]); // Fredoka est déjà chargée dans index.html

function loadFont(name) {
  if (!FONTS[name] || loaded.has(name)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${FONTS[name]}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loaded.add(name);
}

// ------------------------------------------------------------
//  Applique le thème en injectant les variables CSS sur :root
// ------------------------------------------------------------
export function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const s = document.documentElement.style;
  loadFont(t.font);
  s.setProperty("--font", `'${t.font}', system-ui, sans-serif`);
  s.setProperty("--base-size", t.baseSize + "px");
  s.setProperty("--text", t.text);
  s.setProperty("--ink", t.border);
  s.setProperty("--primary", t.primary);
  s.setProperty("--accent", t.accent);
  s.setProperty("--radius", t.radius + "px");
}

function setTheme(patch) {
  commitBoard(d => { d.theme = { ...DEFAULT_THEME, ...d.theme, ...patch }; });
}

// ------------------------------------------------------------
//  Branche les contrôles du panneau "Apparence" (appelé 1 fois)
// ------------------------------------------------------------
export function initThemeControls() {
  const fontSel = document.getElementById("themeFont");
  fontSel.innerHTML = Object.keys(FONTS)
    .map(f => `<option value="${f}">${f}</option>`).join("");
  fontSel.onchange = () => setTheme({ font: fontSel.value });

  bindColor("themeText", "text");
  bindColor("themeBorder", "border");
  bindColor("themePrimary", "primary");
  bindColor("themeAccent", "accent");

  bindRange("themeSize", "baseSize");
  bindRange("themeRadius", "radius");

  document.getElementById("themeResetBtn").onclick = () => setTheme({ ...DEFAULT_THEME });
}

function bindColor(id, key) {
  const el = document.getElementById(id);
  el.oninput = () => setTheme({ [key]: el.value });
}
function bindRange(id, key) {
  const el = document.getElementById(id);
  el.oninput = () => setTheme({ [key]: Number(el.value) });
}

// ------------------------------------------------------------
//  Met à jour les valeurs affichées dans les contrôles
// ------------------------------------------------------------
export function renderThemeControls(config) {
  const t = { ...DEFAULT_THEME, ...((config && config.theme) || {}) };
  setVal("themeFont", t.font);
  setVal("themeText", t.text);
  setVal("themeBorder", t.border);
  setVal("themePrimary", t.primary);
  setVal("themeAccent", t.accent);
  setVal("themeSize", t.baseSize);
  setVal("themeRadius", t.radius);
  setText("themeSizeVal", t.baseSize + " px");
  setText("themeRadiusVal", t.radius + " px");
}

function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
