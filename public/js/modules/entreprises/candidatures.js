import {
  requete, telecharger, message, esc, dateFr, dateHeureFr, tailleLisible,
  BTN_PRIMAIRE, BTN_SECONDAIRE, BTN_PETIT, CHAMP
} from './client.js';

const STATUTS = {
  envoyee: { label: 'Envoyée', classe: 'bg-slate-100 text-slate-700' },
  en_attente: { label: 'En attente', classe: 'bg-amber-100 text-amber-700' },
  entretien: { label: 'Entretien', classe: 'bg-blue-100 text-blue-700' },
  acceptee: { label: 'Acceptée', classe: 'bg-emerald-100 text-emerald-700' },
  refusee: { label: 'Refusée', classe: 'bg-red-100 text-red-700' },
  retiree: { label: 'Retirée', classe: 'bg-zinc-200 text-zinc-700' }
};
const STATUTS_FINAUX = ['refusee', 'retiree'];
const TYPES_DOC = {
  cv: 'CV',
  lettre: 'Lettre de motivation',
  preuve_acceptation: "Preuve d'acceptation"
};
const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo, comme côté serveur

const libelle = (statut) => (STATUTS[statut] ? STATUTS[statut].label : statut);
const badge = (statut) => {
  const st = STATUTS[statut] || { label: statut, classe: 'bg-slate-100 text-slate-700' };
  return `<span class="text-xs px-2.5 py-1 rounded-full font-medium ${st.classe}">${esc(st.label)}</span>`;
};

export async function afficherCandidatures(vue, role, route) {
  const estEtudiant = role === 'etudiant';
  if (route.id) return afficherDetail(vue, estEtudiant, route.id);
  return afficherListe(vue, estEtudiant, route);
}

// ===========================================================================
// Liste « Mes candidatures » (tout pour l'admin, en lecture seule)
// ===========================================================================
async function afficherListe(vue, estEtudiant, route) {
  vue.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 class="text-lg font-semibold">${estEtudiant ? 'Mes candidatures' : 'Toutes les candidatures'}</h3>
      ${estEtudiant ? `<button id="btn-nouvelle" class="${BTN_PRIMAIRE}">Nouvelle candidature</button>` : ''}
    </div>
    <div id="msg"></div>
    <div id="zone-form"></div>
    <div id="liste"><p class="text-sm text-slate-500">Chargement…</p></div>`;

  const zoneMsg = vue.querySelector('#msg');
  const zoneForm = vue.querySelector('#zone-form');
  const liste = vue.querySelector('#liste');

  // ---- Formulaire de nouvelle candidature ---------------------------------
  const ouvrirFormulaire = async (entrepriseIdPreselection) => {
    const resEnt = await requete('/entreprises');
    if (!vue.isConnected) return;
    const validees = resEnt.ok ? resEnt.data.filter((e) => e.statut === 'validee') : [];

    if (validees.length === 0) {
      message(zoneMsg, "Aucune entreprise validée pour le moment. Proposez-en une depuis l'onglet « Entreprises ».");
      return;
    }

    const aujourdhui = new Date().toLocaleDateString('en-CA'); // AAAA-MM-JJ (date locale)
    zoneForm.innerHTML = `
      <form id="form-candidature" class="bg-white border border-slate-200 rounded-xl p-5 mb-5 grid md:grid-cols-2 gap-4">
        <h4 class="md:col-span-2 font-semibold">Nouvelle candidature</h4>
        <label class="text-sm">
          <span class="block mb-1 font-medium text-slate-600">Entreprise *</span>
          <select name="entreprise_id" required class="${CHAMP}">
            ${validees.map((e) => `
              <option value="${e.id}" ${String(e.id) === String(entrepriseIdPreselection) ? 'selected' : ''}>
                ${esc(e.raison_sociale)}
              </option>`).join('')}
          </select>
        </label>
        <label class="text-sm">
          <span class="block mb-1 font-medium text-slate-600">Poste *</span>
          <input name="poste" type="text" required maxlength="150" class="${CHAMP}">
        </label>
        <label class="text-sm">
          <span class="block mb-1 font-medium text-slate-600">Contact</span>
          <input name="contact" type="text" maxlength="150" class="${CHAMP}">
        </label>
        <label class="text-sm">
          <span class="block mb-1 font-medium text-slate-600">Date de candidature</span>
          <input name="date_candidature" type="date" value="${aujourdhui}" class="${CHAMP}">
        </label>
        <div id="erreur-form" class="md:col-span-2"></div>
        <div class="md:col-span-2 flex gap-2">
          <button type="submit" class="${BTN_PRIMAIRE}">Enregistrer</button>
          <button type="button" id="annuler" class="${BTN_SECONDAIRE}">Annuler</button>
        </div>
      </form>`;

    const form = zoneForm.querySelector('#form-candidature');
    const boutonEnvoi = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      boutonEnvoi.disabled = true;
      const res = await requete('/candidatures', {
        method: 'POST',
        json: {
          entreprise_id: Number(form.elements.entreprise_id.value),
          poste: form.elements.poste.value.trim(),
          contact: form.elements.contact.value.trim() || null,
          date_candidature: form.elements.date_candidature.value || null
        }
      });
      if (!vue.isConnected) return;
      boutonEnvoi.disabled = false;
      if (res.ok) {
        // On ouvre le détail pour déposer CV, lettre et preuve
        location.hash = `#entreprises/candidatures/${res.data.id}`;
        return;
      }
      message(form.querySelector('#erreur-form'), res.error.message);
    });
    form.querySelector('#annuler').addEventListener('click', () => { zoneForm.innerHTML = ''; });
    form.elements.poste.focus();
  };

  // ---- Liste -----------------------------------------------------------------
  const res = await requete('/candidatures');
  if (!vue.isConnected) return;

  if (!res.ok) {
    liste.innerHTML = '';
    message(zoneMsg, res.error.message);
  } else if (res.data.length === 0) {
    liste.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
        Aucune candidature pour le moment.${estEtudiant ? ' Cliquez sur « Nouvelle candidature » pour en enregistrer une.' : ''}
      </div>`;
  } else {
    const lignes = res.data.map((c) => `
      <tr class="border-t border-slate-100">
        <td class="px-4 py-3 font-medium">${esc(c.entreprise)}</td>
        ${estEtudiant ? '' : `<td class="px-4 py-3">Étudiant n° ${c.etudiant_id}</td>`}
        <td class="px-4 py-3">${esc(c.poste)}</td>
        <td class="px-4 py-3">${esc(c.contact)}</td>
        <td class="px-4 py-3">${dateFr(c.date_candidature)}</td>
        <td class="px-4 py-3">${badge(c.statut)}</td>
        <td class="px-4 py-3">
          <a href="#entreprises/candidatures/${c.id}" class="${BTN_PETIT} inline-block border border-slate-300 hover:bg-slate-50">Détail</a>
        </td>
      </tr>`).join('');
    liste.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Entreprise</th>
              ${estEtudiant ? '' : '<th class="px-4 py-3">Étudiant</th>'}
              <th class="px-4 py-3">Poste</th><th class="px-4 py-3">Contact</th>
              <th class="px-4 py-3">Date</th><th class="px-4 py-3">Statut</th><th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
      </div>`;
  }

  if (estEtudiant) {
    vue.querySelector('#btn-nouvelle').addEventListener('click', () => ouvrirFormulaire(null));
    if (route.nouvelle) await ouvrirFormulaire(route.entrepriseId);
  }
}

// ===========================================================================
// Détail d'une candidature : statut, documents, historique
// ===========================================================================
async function afficherDetail(vue, estEtudiant, id, notice = null) {
  vue.innerHTML = `<p class="text-sm text-slate-500">Chargement…</p>`;
  const res = await requete(`/candidatures/${id}`);
  if (!vue.isConnected) return;

  if (!res.ok) {
    vue.innerHTML = `
      <a href="#entreprises/candidatures" class="text-sm text-indigo-600 hover:underline">← Retour à la liste</a>
      <div id="msg" class="mt-4"></div>`;
    message(vue.querySelector('#msg'), res.error.message);
    return;
  }

  const c = res.data;
  const clos = STATUTS_FINAUX.includes(c.statut);
  const peutAgir = estEtudiant && !clos;
  const aPreuve = c.documents.some((d) => d.type === 'preuve_acceptation');
  const autresStatuts = Object.keys(STATUTS).filter((s) => s !== c.statut);

  const blocStatut = peutAgir ? `
    <div class="flex flex-wrap items-end gap-3">
      <label class="text-sm">
        <span class="block mb-1 font-medium text-slate-600">Changer le statut</span>
        <select id="nouveau-statut" class="${CHAMP} sm:w-56">
          ${autresStatuts.map((s) => `<option value="${s}">${esc(libelle(s))}</option>`).join('')}
        </select>
      </label>
      <button id="btn-statut" class="${BTN_PRIMAIRE}">Appliquer</button>
    </div>
    ${aPreuve ? '' : `<p class="text-xs text-slate-500 mt-2">
      Le statut « Acceptée » exige une preuve d'acceptation : déposez-la d'abord dans les documents.</p>`}`
    : (estEtudiant ? `<p class="text-sm text-slate-500">Cette candidature est clôturée : plus aucune modification n'est possible.</p>` : '');

  const lignesDocs = c.documents.map((d) => `
    <tr class="border-t border-slate-100">
      <td class="px-4 py-3">${esc(TYPES_DOC[d.type] || d.type)}</td>
      <td class="px-4 py-3">${esc(d.nom_original)}</td>
      <td class="px-4 py-3">${tailleLisible(d.taille)}</td>
      <td class="px-4 py-3">${dateHeureFr(d.depose_le)}</td>
      <td class="px-4 py-3">
        <button data-doc="${d.id}" data-nom="${esc(d.nom_original)}" class="${BTN_PETIT} border border-slate-300 hover:bg-slate-50">Télécharger</button>
      </td>
    </tr>`).join('');

  const blocDocs = c.documents.length === 0
    ? `<p class="text-sm text-slate-500">Aucun document déposé.</p>`
    : `<div class="overflow-x-auto"><table class="w-full text-sm text-left">
         <thead class="bg-slate-50 text-xs uppercase text-slate-500">
           <tr><th class="px-4 py-3">Type</th><th class="px-4 py-3">Fichier</th><th class="px-4 py-3">Taille</th>
               <th class="px-4 py-3">Déposé le</th><th class="px-4 py-3"></th></tr>
         </thead><tbody>${lignesDocs}</tbody></table></div>`;

  const formDoc = peutAgir ? `
    <form id="form-doc" class="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-3">
      <label class="text-sm">
        <span class="block mb-1 font-medium text-slate-600">Type de document</span>
        <select name="type" class="${CHAMP} sm:w-56">
          ${Object.entries(TYPES_DOC).map(([valeur, nom]) => `<option value="${valeur}">${esc(nom)}</option>`).join('')}
        </select>
      </label>
      <label class="text-sm">
        <span class="block mb-1 font-medium text-slate-600">Fichier (PDF ou image, 10 Mo max)</span>
        <input name="fichier" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
               class="text-sm">
      </label>
      <button type="submit" class="${BTN_PRIMAIRE}">Déposer</button>
      <p class="w-full text-xs text-slate-500">Un nouveau dépôt du même type remplace le précédent.</p>
    </form>` : '';

  const lignesHisto = c.historique.map((h) => `
    <li class="flex flex-wrap gap-x-3 text-sm py-2 border-t border-slate-100 first:border-t-0">
      <span class="text-slate-500 w-44">${dateHeureFr(h.change_le)}</span>
      <span>${h.ancien_statut
        ? `${esc(libelle(h.ancien_statut))} → <strong>${esc(libelle(h.nouveau_statut))}</strong>`
        : `Candidature créée : <strong>${esc(libelle(h.nouveau_statut))}</strong>`}</span>
    </li>`).join('');

  vue.innerHTML = `
    <a href="#entreprises/candidatures" class="text-sm text-indigo-600 hover:underline">← Retour à la liste</a>
    <div id="msg" class="mt-4"></div>

    <div class="bg-white border border-slate-200 rounded-xl p-6 mb-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 class="text-lg font-semibold">${esc(c.entreprise)} — ${esc(c.poste)}</h3>
        ${badge(c.statut)}
      </div>
      <dl class="grid sm:grid-cols-3 gap-4 text-sm mb-5">
        <div><dt class="text-slate-500">Contact</dt><dd>${esc(c.contact) || '—'}</dd></div>
        <div><dt class="text-slate-500">Date de candidature</dt><dd>${dateFr(c.date_candidature)}</dd></div>
        ${estEtudiant ? '' : `<div><dt class="text-slate-500">Étudiant</dt><dd>n° ${c.etudiant_id}</dd></div>`}
      </dl>
      ${blocStatut}
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-6 mb-5">
      <h4 class="font-semibold mb-3">Documents</h4>
      ${blocDocs}
      ${formDoc}
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-6">
      <h4 class="font-semibold mb-3">Historique des statuts</h4>
      <ul>${lignesHisto}</ul>
    </div>`;

  const zoneMsg = vue.querySelector('#msg');
  if (notice) message(zoneMsg, notice, 'succes');

  // ---- Changement de statut -------------------------------------------------
  const boutonStatut = vue.querySelector('#btn-statut');
  if (boutonStatut) {
    boutonStatut.addEventListener('click', async () => {
      boutonStatut.disabled = true;
      const statut = vue.querySelector('#nouveau-statut').value;
      const r = await requete(`/candidatures/${id}/statut`, { method: 'PATCH', json: { statut } });
      if (!vue.isConnected) return;
      if (r.ok) {
        await afficherDetail(vue, estEtudiant, id, `Statut mis à jour : ${libelle(statut)}.`);
      } else {
        boutonStatut.disabled = false;
        message(zoneMsg, r.error.message); // ex. : « acceptée » sans preuve (422)
      }
    });
  }

  // ---- Dépôt de document ------------------------------------------------------
  const formulaireDoc = vue.querySelector('#form-doc');
  if (formulaireDoc) {
    formulaireDoc.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fichier = formulaireDoc.elements.fichier.files[0];
      if (!fichier) return message(zoneMsg, 'Choisissez un fichier à déposer.');
      if (fichier.size > TAILLE_MAX) return message(zoneMsg, 'Fichier trop volumineux (10 Mo maximum).');

      const donnees = new FormData();
      donnees.append('type', formulaireDoc.elements.type.value);
      donnees.append('fichier', fichier);

      const bouton = formulaireDoc.querySelector('button[type="submit"]');
      bouton.disabled = true;
      const r = await requete(`/candidatures/${id}/documents`, { method: 'POST', formData: donnees });
      if (!vue.isConnected) return;
      if (r.ok) {
        await afficherDetail(vue, estEtudiant, id, 'Document déposé.');
      } else {
        bouton.disabled = false;
        message(zoneMsg, r.error.message);
      }
    });
  }

  // ---- Téléchargement ----------------------------------------------------------
  vue.querySelectorAll('button[data-doc]').forEach((bouton) => {
    bouton.addEventListener('click', async () => {
      try {
        await telecharger(`/candidatures/${id}/documents/${bouton.dataset.doc}`, bouton.dataset.nom);
      } catch (err) {
        message(zoneMsg, err.message);
      }
    });
  });
}