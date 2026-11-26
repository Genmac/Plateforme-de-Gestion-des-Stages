import {
  requete, message, esc, badge, dateJour, montant, STATUTS_EDITABLES,
  BTN_PRIMAIRE, BTN_PETIT, CHAMP
} from './client.js';

export async function afficherListe(vue, role) {
  const estEtudiant = role === 'etudiant';
  const decideur = role === 'admin' || role === 'responsable';
  const titre = estEtudiant ? 'Ma convention de stage'
    : decideur ? 'Conventions de stage' : 'Conventions de mes stagiaires';

  vue.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 class="text-lg font-semibold">${titre}</h3>
      <span id="action-haut"></span>
    </div>
    <div id="msg"></div>
    ${decideur ? `
      <div class="mb-4">
        <select id="filtre" class="${CHAMP} sm:w-64">
          <option value="a_traiter">À traiter (soumises)</option>
          <option value="">Toutes les conventions</option>
        </select>
      </div>` : ''}
    <div id="liste"><p class="text-sm text-slate-500">Chargement…</p></div>`;

  const zoneMsg = vue.querySelector('#msg');
  const liste = vue.querySelector('#liste');
  const filtre = vue.querySelector('#filtre');

  const charger = async () => {
    const qs = filtre && filtre.value === 'a_traiter' ? '?a_traiter=true' : '';
    const res = await requete(`/conventions${qs}`);
    if (!vue.isConnected) return;

    if (!res.ok) {
      liste.innerHTML = '';
      message(zoneMsg, res.error.message);
      return;
    }

    if (estEtudiant) {
      vue.querySelector('#action-haut').innerHTML = res.data.length === 0
        ? `<a href="#conventions/nouvelle" class="${BTN_PRIMAIRE} inline-block">Nouvelle convention</a>` : '';
    }

    if (res.data.length === 0) {
      liste.innerHTML = `<div class="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
        ${estEtudiant ? 'Vous n\'avez pas encore de convention. Cliquez sur « Nouvelle convention » pour commencer.'
          : (filtre && filtre.value === 'a_traiter' ? 'Aucune convention à traiter.' : 'Aucune convention.')}
      </div>`;
      return;
    }

    const lignes = res.data.map((c) => `
      <tr class="border-t border-slate-100 align-top">
        ${estEtudiant ? '' : `<td class="px-4 py-3 font-medium">${esc(c.etudiant)}</td>`}
        <td class="px-4 py-3">${esc(c.entreprise) || '—'}</td>
        <td class="px-4 py-3">${esc(c.sujet) || '<span class="text-slate-400">(sans sujet)</span>'}</td>
        <td class="px-4 py-3 whitespace-nowrap">${c.date_debut ? `${dateJour(c.date_debut)} → ${dateJour(c.date_fin)}` : '—'}</td>
        <td class="px-4 py-3">${montant(c.gratification) || '—'}</td>
        <td class="px-4 py-3">${esc(c.encadrant) || '<span class="text-slate-400">non affecté</span>'}</td>
        <td class="px-4 py-3">${badge(c.statut)}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          <a href="#conventions/${c.id}" class="${BTN_PETIT} inline-block border border-slate-300 hover:bg-slate-50">Détail</a>
          ${estEtudiant && STATUTS_EDITABLES.includes(c.statut)
            ? `<a href="#conventions/${c.id}/modifier" class="${BTN_PETIT} inline-block bg-indigo-600 text-white hover:bg-indigo-700">Reprendre</a>` : ''}
        </td>
      </tr>`).join('');

    liste.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              ${estEtudiant ? '' : '<th class="px-4 py-3">Étudiant</th>'}
              <th class="px-4 py-3">Entreprise</th><th class="px-4 py-3">Sujet</th>
              <th class="px-4 py-3">Période</th><th class="px-4 py-3">Gratification</th>
              <th class="px-4 py-3">Encadrant</th><th class="px-4 py-3">Statut</th><th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
      </div>`;
  };

  if (filtre) filtre.addEventListener('change', charger);
  await charger();
}