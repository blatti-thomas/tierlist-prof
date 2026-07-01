// Petites fonctions utilitaires partagées.

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function randomColor() {
  const palette = ["#ff5d5d", "#ffa14a", "#ffd84a", "#7ed957",
                   "#4ab8ff", "#b06bff", "#ff7fc4", "#5de0c4"];
  return palette[Math.floor(Math.random() * palette.length)];
}

// Crée une icône Material Symbols (pour les éléments générés en JS)
export function icon(name) {
  const s = document.createElement("span");
  s.className = "material-symbols-rounded";
  s.textContent = name;
  return s;
}

// "il y a X min" à partir d'un Timestamp Firestore
export function relativeTime(ts) {
  if (!ts?.seconds) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts.seconds));
  if (s < 60)     return "à l'instant";
  if (s < 3600)   return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400)  return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}
