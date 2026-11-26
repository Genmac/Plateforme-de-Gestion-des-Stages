import { session } from '../../core/session.js';

// Styles réutilisés (classes Tailwind)
export const BTN_PRIMAIRE = 'px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50';
export const BTN_SECONDAIRE = 'px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition disabled:opacity-50';
export const BTN_PETIT = 'px-3 py-1 text-xs font-medium rounded-md transition disabled:opacity-50';
export const CHAMP = 'w-full text-sm border border-slate-300 rounded-md p-2 bg-white';

export const STATUTS = {
  brouillon: { label: 'Brouillon', classe: 'bg-slate-100 text-slate-700' },
  soumise: { label: 'Soumise', classe: 'bg-blue-100 text-blue-700' },
  validee: { label: 'Validée', classe: 'bg-emerald-100 text-emerald-700' },
  refusee: { label: 'Refusée', classe: 'bg-red-100 text-red-700' },
  a_corriger: { label: 'À corriger', classe: 'bg-amber-100 text-amber-700' }
};
export const ORIGINES = {
  initiative_etudiant: "Initiative de l'étudiant",
  envoi_departement: 'Envoi par le département',
  demande_entreprise: "Demande de l'entreprise"
};
export const STATUTS_EDITABLES = ['brouillon', 'a_corriger'];

/** Échappe le HTML : à utiliser pour TOUT texte venant de la base ou de l'utilisateur. */
export const esc = (valeur) =>
  String(valeur ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

export const libelleStatut = (s) => (STATUTS[s] ? STATUTS[s].label : s);
export const badge = (s) => {
  const st = STATUTS[s] || { label: s, classe: 'bg-slate-100 text-slate-700' };
  return `<span class="text-xs px-2.5 py-1 rounded-full font-medium ${st.classe}">${esc(st.label)}</span>`;
};

/** AAAA-MM-JJ (début d'une date ISO) : sans conversion de fuseau horaire. */
export const jour = (v) => (v ? String(v).slice(0, 10) : '');
export const dateJour = (v) => (v ? jour(v).split('-').reverse().join('/') : '');
export const dateHeureFr = (v) => (v ? new Date(v).toLocaleString('fr-FR') : '');
export const montant = (v) => (v === null || v === undefined || v === '' ? '' : `${Number(v).toLocaleString('fr-FR')} FCFA`);

/** Affiche un message (erreur ou succès) dans une zone. */
export function message(zone, texte, type = 'erreur') {
  if (!zone) return;
  const classes = type === 'succes'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-red-50 text-red-800 border-red-200';
  zone.innerHTML = `<div role="alert" class="mb-4 px-4 py-3 rounded-lg border text-sm ${classes}">${esc(texte)}</div>`;
}

function entetes() {
  const h = {};
  const token = session.getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  else h['x-dev-user'] = session.getDevUser();
  return h;
}

/**
 * Appel JSON. Ne lève jamais d'exception : renvoie
 *  { ok: true, status, data }  ou  { ok: false, status, error: { code, message, ...extra } }
 */
export async function requete(url, { method = 'GET', json } = {}) {
  const options = { method, headers: entetes() };
  if (json !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(json);
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