import { requete, message, esc, BTN_PRIMAIRE, BTN_SECONDAIRE, BTN_PETIT, CHAMP } from './client.js';

const STATUTS = {
  a_valider: { label: 'À valider', classe: 'bg-amber-100 text-amber-700' },
  validee: { label: 'Validée', classe: 'bg-emerald-100 text-emerald-700' },
  rejetee: { label: 'Rejetée', classe: 'bg-red-100 text-red-700' }
};

// [nom du champ, libellé, type d'input, obligatoire]
const CHAMPS = [
  ['raison_sociale', "Nom de l'entreprise *", 'text', true],
  ['secteur_activite', 'Secteur', 'text', false],
  ['adresse', 'Adresse', 'text', false],
  ['contact_nom', 'Contact (nom)', 'text', false],
  ['contact_email', 'Contact (e-mail)', 'email', false],
  ['contact_telephone', 'Contact (téléphone)', 'tel', false],
  ['site_web', 'Site web (https://...)', 'url', false]
];

// N'affiche un lien que pour http(s) : empêche les liens « javascript: »
const lienSite = (url) =>
  /^https?:\/\//i.test(url || '')
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline text-xs break-all">${esc(url)}</a>`
    : '';

export async function afficherEntreprises(vue, role) {
  const estAdmin = role === 'admin' || role === 'responsable';
  const cache = new Map(); // id -> entreprise (pour pré-remplir le formulaire de modification)

  vue.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 class="text-lg font-semibold">Entreprises</h3>
      <button id="btn-proposer" class="${BTN_PRIMAIRE}">
        ${estAdmin ? 'Ajouter une entreprise' : 'Proposer une entreprise'}
      </button>
    </div>
    <div id="msg"></div>
    <div id="zone-form"></div>
    <div class="flex flex-wrap gap-3 mb-4">
      <input id="recherche" type="search" placeholder="Rechercher par nom..." class="${CHAMP} sm:w-72">
      ${estAdmin ? `
        <select id="filtre-statut" class="${CHAMP} sm:w-48">
          <option value="">Tous les statuts</option>
          <option value="a_valider">À valider</option>
          <option value="validee">Validées</option>
          <option value="rejetee">Rejetées</option>
        </select>` : ''}
    </div>
    <div id="liste"></div>`;

  const zoneMsg = vue.querySelector('#msg');
  const zoneForm = vue.querySelector('#zone-form');
  const liste = vue.querySelector('#liste');
  const champRecherche = vue.querySelector('#recherche');
  const filtreStatut = vue.querySelector('#filtre-statut'); // null pour un étudiant

  // ---- Tableau ----------------------------------------------------------
  const actions = (e) => {
    if (estAdmin) {
      const boutons = [];
      if (e.statut === 'a_valider') {
        boutons.push(`<button data-action="valider" data-id="${e.id}" class="${BTN_PETIT} bg-emerald-600 text-white hover:bg-emerald-700">Valider</button>`);
        boutons.push(`<button data-action="rejeter" data-id="${e.id}" class="${BTN_PETIT} bg-red-600 text-white hover:bg-red-700">Rejeter</button>`);
      }
      boutons.push(`<button data-action="modifier" data-id="${e.id}" class="${BTN_PETIT} border border-slate-300 hover:bg-slate-50">Modifier</button>`);
      return boutons.join(' ');
    }
    if (e.statut === 'validee') {
      return `<a href="#entreprises/candidatures/nouvelle/${e.id}" class="${BTN_PETIT} inline-block bg-indigo-600 text-white hover:bg-indigo-700">Candidater</a>`;
    }
    return '';
  };

  const tableau = (entreprises) => {
    if (entreprises.length === 0) {
      return `<div class="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Aucune entreprise trouvée.</div>`;
    }
    const lignes = entreprises.map((e) => {
      const st = STATUTS[e.statut] || { label: e.statut, classe: 'bg-slate-100 text-slate-700' };
      const contact = [e.contact_nom, e.contact_email, e.contact_telephone].filter(Boolean).map(esc).join('<br>');
      return `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3"><div class="font-medium">${esc(e.raison_sociale)}</div>${lienSite(e.site_web)}</td>
          <td class="px-4 py-3">${esc(e.secteur_activite)}</td>
          <td class="px-4 py-3">${esc(e.adresse)}</td>
          <td class="px-4 py-3 text-xs">${contact}</td>
          <td class="px-4 py-3"><span class="text-xs px-2.5 py-1 rounded-full font-medium ${st.classe}">${st.label}</span></td>
          <td class="px-4 py-3 whitespace-nowrap">${actions(e)}</td>
        </tr>`;
    }).join('');
    return `
      <div class="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Entreprise</th><th class="px-4 py-3">Secteur</th>
              <th class="px-4 py-3">Adresse</th><th class="px-4 py-3">Contact</th>
              <th class="px-4 py-3">Statut</th><th class="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
      </div>`;
  };

  const charger = async () => {
    const params = new URLSearchParams();
    const q = champRecherche.value.trim();
    if (q) params.set('q', q);
    if (filtreStatut && filtreStatut.value) params.set('statut', filtreStatut.value);
    const res = await requete(`/entreprises${params.toString() ? `?${params}` : ''}`);
    if (!vue.isConnected) return;
    if (!res.ok) {
      liste.innerHTML = '';
      message(zoneMsg, res.error.message);
      return;
    }
    cache.clear();
    res.data.forEach((e) => cache.set(e.id, e));
    liste.innerHTML = tableau(res.data);
  };

  // ---- Formulaire (création, proposition ou modification) ---------------
  const ouvrirFormulaire = (entreprise = null) => {
    const edition = entreprise !== null;
    const titre = edition
      ? `Modifier « ${esc(entreprise.raison_sociale)} »`
      : (estAdmin ? 'Ajouter une entreprise' : 'Proposer une entreprise');

    zoneForm.innerHTML = `
      <form id="form-entreprise" class="bg-white border border-slate-200 rounded-xl p-5 mb-5 grid md:grid-cols-2 gap-4">
        <h4 class="md:col-span-2 font-semibold">${titre}</h4>
        ${CHAMPS.map(([nom, libelle, type, requis]) => `
          <label class="text-sm">
            <span class="block mb-1 font-medium text-slate-600">${libelle}</span>
            <input name="${nom}" type="${type}" ${requis ? 'required' : ''}
                   value="${esc(entreprise ? entreprise[nom] : '')}" class="${CHAMP}">
          </label>`).join('')}
        ${!edition && !estAdmin ? `
          <p class="md:col-span-2 text-xs text-slate-500">
            Votre proposition aura le statut « à valider » jusqu'à sa validation par l'administration.
          </p>` : ''}
        <div id="alerte-doublon" class="md:col-span-2"></div>
        <div class="md:col-span-2 flex gap-2">
          <button type="submit" class="${BTN_PRIMAIRE}">Enregistrer</button>
          <button type="button" id="annuler" class="${BTN_SECONDAIRE}">Annuler</button>
        </div>
      </form>`;

    const form = zoneForm.querySelector('#form-entreprise');
    const zoneAlerte = form.querySelector('#alerte-doublon');
    const boutonEnvoi = form.querySelector('button[type="submit"]');

    const envoyer = async (confirmerDoublon) => {
      const donnees = {};
      for (const [nom] of CHAMPS) {
        const valeur = form.elements[nom].value.trim();
        if (edition || valeur) donnees[nom] = valeur; // en création, on n'envoie pas les champs vides
      }
      if (confirmerDoublon) donnees.confirmer_doublon = true;

      boutonEnvoi.disabled = true;
      const res = edition
        ? await requete(`/entreprises/${entreprise.id}`, { method: 'PUT', json: donnees })
        : await requete('/entreprises', { method: 'POST', json: donnees });
      if (!vue.isConnected) return;
      boutonEnvoi.disabled = false;

      if (res.ok) {
        zoneForm.innerHTML = '';
        message(zoneMsg, edition
          ? 'Entreprise modifiée.'
          : (estAdmin ? 'Entreprise ajoutée.' : "Proposition envoyée : l'administration va l'examiner."), 'succes');
        await charger();
        return;
      }

      // Alerte de doublon : on laisse l'utilisateur confirmer
      if (res.status === 409 && res.error.code === 'DUPLICATE_WARNING') {
        const doublons = res.error.doublons || [];
        zoneAlerte.innerHTML = `
          <div class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p class="font-semibold mb-1">Une entreprise portant ce nom existe déjà :</p>
            <ul class="list-disc ml-5 mb-3">
              ${doublons.map((d) => `<li>${esc(d.raison_sociale)} (${esc(STATUTS[d.statut] ? STATUTS[d.statut].label : d.statut)})</li>`).join('')}
            </ul>
            <button type="button" id="btn-forcer" class="${BTN_PETIT} bg-amber-600 text-white hover:bg-amber-700">Créer quand même</button>
          </div>`;
        zoneAlerte.querySelector('#btn-forcer').addEventListener('click', () => envoyer(true));
        return;
      }

      message(zoneAlerte, res.error.message);
    };

    form.addEventListener('submit', (ev) => { ev.preventDefault(); envoyer(false); });
    form.querySelector('#annuler').addEventListener('click', () => { zoneForm.innerHTML = ''; });
    form.elements.raison_sociale.focus();
  };

  // ---- Événements ---------------------------------------------------------
  vue.querySelector('#btn-proposer').addEventListener('click', () => ouvrirFormulaire());

  let minuteur;
  champRecherche.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(charger, 300); // évite une requête à chaque frappe
  });
  if (filtreStatut) filtreStatut.addEventListener('change', charger);

  liste.addEventListener('click', async (ev) => {
    const bouton = ev.target.closest('button[data-action]');
    if (!bouton) return;
    const { action, id } = bouton.dataset;
    const entreprise = cache.get(Number(id));
    if (!entreprise) return;

    if (action === 'modifier') {
      ouvrirFormulaire(entreprise);
      zoneForm.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (action === 'valider' || action === 'rejeter') {
      if (action === 'rejeter' && !confirm(`Rejeter la proposition « ${entreprise.raison_sociale} » ?`)) return;
      bouton.disabled = true;
      const res = await requete(`/entreprises/${id}/${action}`, { method: 'PATCH' });
      if (!vue.isConnected) return;
      if (res.ok) {
        message(zoneMsg, action === 'valider' ? 'Entreprise validée.' : 'Entreprise rejetée.', 'succes');
      } else {
        message(zoneMsg, res.error.message);
      }
      await charger();
    }
  });

  await charger();
}