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
