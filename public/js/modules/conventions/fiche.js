import {
  requete, message, esc, badge, dateJour, dateHeureFr, montant, libelleStatut,
  ORIGINES, STATUTS_EDITABLES, BTN_PRIMAIRE, BTN_PETIT, CHAMP
} from './client.js';

export async function afficherFiche(vue, role, id, notice = null) {
  vue.innerHTML = '<p class="text-sm text-slate-500">Chargement…</p>';

  const estAdmin = role === 'admin';
  const decideur = role === 'admin' || role === 'responsable';
  const [res, resOptions] = await Promise.all([
    requete(`/conventions/${id}`),
    estAdmin ? requete('/conventions/options') : Promise.resolve(null)
  ]);
  if (!vue.isConnected) return;

  if (!res.ok) {
    vue.innerHTML = `<a href="#conventions" class="text-sm text-indigo-600 hover:underline">← Retour aux conventions</a>
      <div id="msg" class="mt-4"></div>`;
    message(vue.querySelector('#msg'), res.error.message);
    return;
  }

  const c = res.data;
  const encadrants = resOptions && resOptions.ok ? resOptions.data.encadrants : [];
  const peutDecider = decideur && c.statut === 'soumise';
  const peutModifier = role === 'etudiant' && STATUTS_EDITABLES.includes(c.statut);

  const ligne = (nom, valeur) => `
    <div><dt class="text-slate-500 text-sm">${nom}</dt><dd class="text-sm">${valeur || '<span class="text-slate-400">—</span>'}</dd></div>`;

  const alerteMotif = c.motif && (c.statut === 'a_corriger' || c.statut === 'refusee') ? `
    <div class="mb-5 rounded-lg border ${c.statut === 'refusee' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'} p-4 text-sm">
      <p class="font-semibold mb-1">${c.statut === 'refusee' ? 'Convention refusée' : 'Correction demandée'}</p>
      <p>${esc(c.motif)}</p>
    </div>` : '';

  const blocDecision = peutDecider ? `
    <div class="bg-white border border-slate-200 rounded-xl p-6 mb-5">
      <h4 class="font-semibold mb-3">Décision</h4>
      <label class="text-sm block mb-3">
        <span class="block mb-1 font-medium text-slate-600">Motif (obligatoire pour un refus ou une correction)</span>
        <textarea id="motif" rows="3" class="${CHAMP}"></textarea>
      </label>
      <div class="flex flex-wrap gap-2">
        <button data-decision="validee" class="${BTN_PETIT} bg-emerald-600 text-white hover:bg-emerald-700 !px-4 !py-2 !text-sm">Valider</button>
        <button data-decision="a_corriger" class="${BTN_PETIT} bg-amber-500 text-white hover:bg-amber-600 !px-4 !py-2 !text-sm">Demander une correction</button>
        <button data-decision="refusee" class="${BTN_PETIT} bg-red-600 text-white hover:bg-red-700 !px-4 !py-2 !text-sm">Refuser</button>
      </div>
    </div>` : '';

  const blocAffectation = estAdmin ? `
    <div class="bg-white border border-slate-200 rounded-xl p-6 mb-5">
      <h4 class="font-semibold mb-3">Encadrant académique</h4>
      <div class="flex flex-wrap items-end gap-3">
        <select id="encadrant" class="${CHAMP} sm:w-72">
          <option value="">— Choisir —</option>
          ${encadrants.map((e) => `<option value="${e.id}" ${e.id === c.encadrant_id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}
        </select>
        <button id="btn-affecter" class="${BTN_PRIMAIRE}">Affecter</button>
      </div>
    </div>` : '';

  const historique = c.historique.map((h) => `
    <li class="py-3 border-t border-slate-100 first:border-t-0 text-sm">
      <div class="flex flex-wrap gap-x-3">
        <span class="text-slate-500 w-44">${dateHeureFr(h.change_le)}</span>
        <span>${h.ancien_statut
          ? `${esc(libelleStatut(h.ancien_statut))} → <strong>${esc(libelleStatut(h.nouveau_statut))}</strong>`
          : `Création : <strong>${esc(libelleStatut(h.nouveau_statut))}</strong>`}
          <span class="text-slate-500"> par ${esc(h.auteur) || 'inconnu'}</span></span>
      </div>
      ${h.commentaire ? `<p class="text-slate-600 mt-1 sm:ml-[11.75rem]">${esc(h.commentaire)}</p>` : ''}
    </li>`).join('');

  vue.innerHTML = `
    <a href="#conventions" class="text-sm text-indigo-600 hover:underline">← Retour aux conventions</a>
    <div id="msg" class="mt-4"></div>

    <div class="bg-white border border-slate-200 rounded-xl p-6 mb-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 class="text-lg font-semibold">${esc(c.sujet) || 'Convention sans sujet'}</h3>
        <div class="flex items-center gap-3">
          ${badge(c.statut)}
          ${peutModifier ? `<a href="#conventions/${c.id}/modifier" class="${BTN_PRIMAIRE} inline-block">Reprendre</a>` : ''}
        </div>
      </div>
      ${alerteMotif}
      <dl class="grid sm:grid-cols-3 gap-4">
        ${ligne('Étudiant', esc(c.etudiant))}
        ${ligne('Entreprise', esc(c.entreprise))}
        ${ligne('Tuteur en entreprise', esc(c.tuteur))}
        ${ligne('Encadrant académique', esc(c.encadrant))}
        ${ligne('Origine', esc(ORIGINES[c.origine] || c.origine))}
        ${ligne('Gratification', esc(montant(c.gratification)))}
        ${ligne('Période', c.date_debut ? `${dateJour(c.date_debut)} → ${dateJour(c.date_fin)}` : '')}
        ${ligne('Soumise le', c.soumise_le ? dateHeureFr(c.soumise_le) : '')}
      </dl>
      <div class="mt-4 text-sm">
        <p class="text-slate-500">Missions</p>
        <p class="whitespace-pre-line">${esc(c.missions) || '<span class="text-slate-400">—</span>'}</p>
      </div>
    </div>

    ${blocDecision}
    ${blocAffectation}

    <div class="bg-white border border-slate-200 rounded-xl p-6">
      <h4 class="font-semibold mb-3">Historique</h4>
      <ul>${historique}</ul>
    </div>`;

  const zoneMsg = vue.querySelector('#msg');
  if (notice) message(zoneMsg, notice, 'succes');

  // ---- Décision --------------------------------------------------------------
  vue.querySelectorAll('button[data-decision]').forEach((bouton) => {
    bouton.addEventListener('click', async () => {
      const decision = bouton.dataset.decision;
      const motif = vue.querySelector('#motif').value.trim();
      if (decision !== 'validee' && !motif) {
        message(zoneMsg, 'Un motif est obligatoire pour un refus ou une demande de correction.');
        return;
      }
      if (decision === 'refusee' && !confirm('Refuser définitivement cette convention ?')) return;

      vue.querySelectorAll('button[data-decision]').forEach((b) => { b.disabled = true; });
      const r = await requete(`/conventions/${c.id}/decision`, { method: 'PATCH', json: { decision, motif } });
      if (!vue.isConnected) return;
      if (r.ok) {
        await afficherFiche(vue, role, id, `Convention ${libelleStatut(decision).toLowerCase()}.`);
      } else {
        vue.querySelectorAll('button[data-decision]').forEach((b) => { b.disabled = false; });
        message(zoneMsg, r.error.message);
      }
    });
  });

  // ---- Affectation de l'encadrant ---------------------------------------------
  const boutonAffecter = vue.querySelector('#btn-affecter');
  if (boutonAffecter) {
    boutonAffecter.addEventListener('click', async () => {
      const encadrantId = Number(vue.querySelector('#encadrant').value);
      if (!encadrantId) { message(zoneMsg, 'Choisissez un encadrant.'); return; }
      boutonAffecter.disabled = true;
      const r = await requete(`/stages/${c.stage_id}/encadrant`, { method: 'PATCH', json: { encadrant_id: encadrantId } });
      if (!vue.isConnected) return;
      if (r.ok) {
        await afficherFiche(vue, role, id, 'Encadrant affecté.');
      } else {
        boutonAffecter.disabled = false;
        message(zoneMsg, r.error.message);
      }
    });
  }
}