import { session } from '../../core/session.js';

// ---------------------------------------------------------------------------
// Styles réutilisés (classes Tailwind)
// ---------------------------------------------------------------------------
export const BTN_PRIMAIRE = 'px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50';
export const BTN_SECONDAIRE = 'px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition';
export const BTN_PETIT = 'px-3 py-1 text-xs font-medium rounded-md transition disabled:opacity-50';
export const CHAMP = 'w-full text-sm border border-slate-300 rounded-md p-2 bg-white';

// ---------------------------------------------------------------------------
// Utilitaires d'affichage
// ---------------------------------------------------------------------------

/** Échappe le HTML : à utiliser pour TOUT texte venant de la base ou de l'utilisateur. */
export const esc = (valeur) =>
  String(valeur ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

export const dateFr = (valeur) => (valeur ? new Date(valeur).toLocaleDateString('fr-FR') : '');
export const dateHeureFr = (valeur) => (valeur ? new Date(valeur).toLocaleString('fr-FR') : '');

export const tailleLisible = (octets) => {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
};

/** Affiche un message (erreur ou succès) dans une zone. */
export function message(zone, texte, type = 'erreur') {
  if (!zone) return;
  const classes = type === 'succes'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-red-50 text-red-800 border-red-200';
  zone.innerHTML = `<div role="alert" class="mb-4 px-4 py-3 rounded-lg border text-sm ${classes}">${esc(texte)}</div>`;
}

// ---------------------------------------------------------------------------
// Appels API (même authentification que core/api.js : JWT, sinon x-dev-user)
// ---------------------------------------------------------------------------
function entetes() {
  const h = {};
  const token = session.getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  else h['x-dev-user'] = session.getDevUser();
  return h;
}

/**
 * Appel JSON ou multipart. Ne lève jamais d'exception : renvoie
 *  { ok: true, status, data }  ou  { ok: false, status, error: { code, message, ...extra } }
 * (contrairement à apiFetch, la liste « doublons » d'un 409 est conservée).
 */
export async function requete(url, { method = 'GET', json, formData } = {}) {
  const options = { method, headers: entetes() };
  if (json !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(json);
  } else if (formData) {
    options.body = formData; // le navigateur fixe lui-même le Content-Type (multipart + séparateur)
  }

  let reponse;
  try {
    reponse = await fetch(`/api${url}`, options);
  } catch (e) {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Serveur injoignable.' } };
  }

  let corps = null;
  try { corps = await reponse.json(); } catch (e) { /* réponse sans JSON */ }

  if (reponse.ok && corps && corps.success !== false) {
    return { ok: true, status: reponse.status, data: corps.data };
  }
  return {
    ok: false,
    status: reponse.status,
    error: corps?.error || { code: 'HTTP_ERROR', message: `Erreur ${reponse.status}` }
  };
}

/** Télécharge un fichier protégé (l'en-tête d'authentification impose de passer par fetch). */
export async function telecharger(url, nomFichier) {
  const reponse = await fetch(`/api${url}`, { headers: entetes() });
  if (!reponse.ok) {
    let texte = 'Téléchargement impossible.';
    try { texte = (await reponse.json()).error?.message || texte; } catch (e) { /* ignore */ }
    throw new Error(texte);
  }
  const blob = await reponse.blob();
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
}