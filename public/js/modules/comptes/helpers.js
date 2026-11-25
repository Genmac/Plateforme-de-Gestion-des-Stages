export const LIBELLES_ROLES = {
  admin: "Administration",
  responsable: "Responsable des stages",
  etudiant: "Étudiant",
  entreprise: "Entreprise (tuteur)",
};

/** Création d'éléments DOM : le texte est toujours inséré comme texte (pas d'injection HTML). */
export function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function")
      n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else n.setAttribute(k, v);
  }
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

export const formaterDate = (d, defaut = "Jamais") =>
  d
    ? new Date(d).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : defaut;

export const CLASSE_CHAMP =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
export const CLASSE_BOUTON =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition disabled:opacity-60";
export const CLASSE_BOUTON_SECONDAIRE =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition";
