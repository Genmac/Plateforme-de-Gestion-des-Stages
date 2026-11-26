import {
  requete, message, esc, jour, montant, ORIGINES, STATUTS_EDITABLES,
  BTN_PRIMAIRE, BTN_SECONDAIRE, CHAMP
} from './client.js';

const ETAPES = ['Entreprise', 'Sujet et missions', 'Durée et gratification', 'Récapitulatif'];

// Étape où se trouve chaque champ (pour revenir sur les champs manquants à la soumission)
const ETAPE_DU_CHAMP = {
  entreprise_id: 0, tuteur_id: 0, sujet: 1, missions: 1,
  date_debut: 2, date_fin: 2, gratification: 2
};
const LIBELLE_CHAMP = {
  entreprise_id: 'entreprise', tuteur_id: 'entreprise (tuteur)', sujet: 'sujet', missions: 'missions',
  date_debut: 'date de début', date_fin: 'date de fin', gratification: 'gratification'
};

export async function afficherFormulaire(vue, role, id) {
  if (role !== 'etudiant') {
    vue.innerHTML = `<div class="bg-white p-6 rounded-xl border border-slate-200 text-sm text-slate-600">
      Seul un étudiant peut remplir une convention.</div>`;
    return;
  }

  const [resOptions, resListe] = await Promise.all([
    requete('/conventions/options'),
    id ? Promise.resolve(null) : requete('/conventions')
  ]);
  if (!vue.isConnected) return;

  if (!resOptions.ok) {
    vue.innerHTML = '<div id="msg"></div>';
    message(vue.querySelector('#msg'), resOptions.error.message);
    return;
  }
  const entreprises = resOptions.data.entreprises;

  // État du formulaire
  const etat = { id: null, etape: 0 };
  const v = {
    entreprise_id: '', origine: 'initiative_etudiant', sujet: '', missions: '',
    date_debut: '', date_fin: '', gratification: ''
  };

  if (id) {
    const r = await requete(`/conventions/${id}`);
    if (!vue.isConnected) return;
    if (!r.ok) {
      vue.innerHTML = `<a href="#conventions" class="text-sm text-indigo-600 hover:underline">← Retour</a><div id="msg" class="mt-4"></div>`;
      message(vue.querySelector('#msg'), r.error.message);
      return;
    }
    const c = r.data;
    if (!STATUTS_EDITABLES.includes(c.statut)) { location.hash = `#conventions/${id}`; return; }
    etat.id = c.id;
    v.entreprise_id = c.entreprise_id ? String(c.entreprise_id) : '';
    v.origine = c.origine || 'initiative_etudiant';
    v.sujet = c.sujet || '';
    v.missions = c.missions || '';
    v.date_debut = jour(c.date_debut);
    v.date_fin = jour(c.date_fin);
    v.gratification = c.gratification !== null && c.gratification !== undefined ? String(Number(c.gratification)) : '';
  } else if (resListe && resListe.ok && resListe.data.length > 0) {
    // Un seul stage actif par étudiant : on renvoie vers la convention existante
    const existante = resListe.data[0];
    vue.innerHTML = `
      <div class="bg-white p-6 rounded-xl border border-slate-200 text-sm">
        <p class="mb-3">Vous avez déjà une convention de stage (un seul stage actif par étudiant).</p>
        <a href="#conventions/${existante.id}" class="${BTN_PRIMAIRE} inline-block">Ouvrir ma convention</a>
      </div>`;
    return;
  }

  // ---- Outils ----------------------------------------------------------------
  const tuteurDe = () => {
    const e = entreprises.find((x) => String(x.id) === String(v.entreprise_id));
    return e ? e.tuteur_id : null;
  };
  const charge = () => ({
    entreprise_id: v.entreprise_id || null,
    tuteur_id: tuteurDe(),
    origine: v.origine,
    sujet: v.sujet.trim(),
    missions: v.missions.trim(),
    gratification: v.gratification,
    date_debut: v.date_debut,
    date_fin: v.date_fin
  });

  const verifierDates = () => {
    if (v.date_debut && v.date_fin && !(v.date_fin > v.date_debut)) {
      return 'La date de fin doit être postérieure à la date de début.';
    }
    return null;
  };

  /** Enregistre le brouillon : crée la convention la première fois, la modifie ensuite. */
  const sauver = async () => {
    const res = etat.id
      ? await requete(`/conventions/${etat.id}`, { method: 'PUT', json: charge() })
      : await requete('/conventions', { method: 'POST', json: charge() });
    if (res.ok && !etat.id) {
      etat.id = res.data.id;
      // replaceState ne déclenche pas « hashchange » : le formulaire reste affiché
      history.replaceState(null, '', `#conventions/${etat.id}/modifier`);
    }
    return res;
  };

  // ---- Affichage d'une étape ----------------------------------------------------
  const champ = (nom, libelle, html) => `
    <label class="text-sm block">
      <span class="block mb-1 font-medium text-slate-600">${libelle}</span>${html}
    </label>`;

  const contenuEtape = () => {
    if (etat.etape === 0) {
      return `
        ${champ('entreprise_id', 'Entreprise d\'accueil *', `
          <select name="entreprise_id" class="${CHAMP}">
            <option value="">— Choisir —</option>
            ${entreprises.map((e) => `<option value="${e.id}" ${String(e.id) === String(v.entreprise_id) ? 'selected' : ''}>${esc(e.raison_sociale)}</option>`).join('')}
          </select>`)}
        <p class="text-xs text-slate-500">Le tuteur en entreprise est le compte rattaché à l'entreprise choisie.
          ${entreprises.length === 0 ? '<strong>Aucune entreprise avec compte tuteur n\'est disponible.</strong>' : ''}</p>
        ${champ('origine', 'Comment avez-vous obtenu ce stage ? *', `
          <select name="origine" class="${CHAMP}">
            ${Object.entries(ORIGINES).map(([val, nom]) => `<option value="${val}" ${val === v.origine ? 'selected' : ''}>${esc(nom)}</option>`).join('')}
          </select>`)}`;
    }
    if (etat.etape === 1) {
      return `
        ${champ('sujet', 'Sujet du stage *', `<input name="sujet" type="text" maxlength="255" value="${esc(v.sujet)}" class="${CHAMP}">`)}
        ${champ('missions', 'Missions confiées *', `<textarea name="missions" rows="6" class="${CHAMP}">${esc(v.missions)}</textarea>`)}`;
    }
    if (etat.etape === 2) {
      return `
        <div class="grid sm:grid-cols-2 gap-4">
          ${champ('date_debut', 'Date de début *', `<input name="date_debut" type="date" value="${esc(v.date_debut)}" class="${CHAMP}">`)}
          ${champ('date_fin', 'Date de fin *', `<input name="date_fin" type="date" value="${esc(v.date_fin)}" class="${CHAMP}">`)}
        </div>
        ${champ('gratification', 'Gratification (FCFA) *', `<input name="gratification" type="number" min="0" step="any" value="${esc(v.gratification)}" class="${CHAMP} sm:w-64">`)}`;
    }
    const e = entreprises.find((x) => String(x.id) === String(v.entreprise_id));
    const ligne = (nom, valeur) => `
      <div class="flex gap-3 py-2 border-t border-slate-100 first:border-t-0 text-sm">
        <dt class="w-44 text-slate-500 shrink-0">${nom}</dt>
        <dd>${valeur ? esc(valeur) : '<span class="text-amber-600">non renseigné</span>'}</dd>
      </div>`;
    return `
      <dl>
        ${ligne('Entreprise', e ? e.raison_sociale : '')}
        ${ligne('Origine', ORIGINES[v.origine])}
        ${ligne('Sujet', v.sujet)}
        ${ligne('Missions', v.missions)}
        ${ligne('Période', v.date_debut && v.date_fin ? `${v.date_debut} → ${v.date_fin}` : '')}
        ${ligne('Gratification', montant(v.gratification))}
      </dl>
      <p class="text-xs text-slate-500">Une fois soumise, la convention ne peut plus être modifiée sauf demande de correction.</p>`;
  };

  const dessiner = (notice = null, typeNotice = 'erreur') => {
    const derniere = etat.etape === ETAPES.length - 1;
    vue.innerHTML = `
      <a href="#conventions" class="text-sm text-indigo-600 hover:underline">← Retour aux conventions</a>
      <h3 class="text-lg font-semibold mt-3 mb-4">${etat.id ? 'Reprendre ma convention' : 'Nouvelle convention de stage'}</h3>

      <ol class="flex flex-wrap gap-2 mb-5 text-xs">
        ${ETAPES.map((nom, i) => `
          <li class="px-3 py-1 rounded-full font-medium ${i === etat.etape ? 'bg-indigo-600 text-white' : (i < etat.etape ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}">
            ${i + 1}. ${esc(nom)}
          </li>`).join('')}
      </ol>

      <div id="msg"></div>
      <form id="form-convention" class="bg-white border border-slate-200 rounded-xl p-5 space-y-4" novalidate>
        ${contenuEtape()}
        <div class="flex flex-wrap gap-2 pt-2">
          ${etat.etape > 0 ? `<button type="button" id="precedent" class="${BTN_SECONDAIRE}">Précédent</button>` : ''}
          <button type="button" id="brouillon" class="${BTN_SECONDAIRE}">Enregistrer le brouillon</button>
          ${derniere
            ? `<button type="button" id="soumettre" class="${BTN_PRIMAIRE}">Soumettre la convention</button>`
            : `<button type="button" id="suivant" class="${BTN_PRIMAIRE}">Suivant</button>`}
        </div>
      </form>`;

    const zoneMsg = vue.querySelector('#msg');
    if (notice) message(zoneMsg, notice, typeNotice);

    const form = vue.querySelector('#form-convention');
    // Garde les valeurs saisies en mémoire (pour changer d'étape sans rien perdre)
    form.addEventListener('input', (ev) => {
      if (ev.target.name in v) v[ev.target.name] = ev.target.value;
    });
    form.addEventListener('change', (ev) => {
      if (ev.target.name in v) v[ev.target.name] = ev.target.value;
    });

    const boutons = () => form.querySelectorAll('button');
    const occupe = (etatBouton) => boutons().forEach((b) => { b.disabled = etatBouton; });

    // Sauvegarde commune à « Suivant », « Précédent » et « Enregistrer le brouillon »
    const enregistrer = async () => {
      const probleme = verifierDates();
      if (probleme) { message(zoneMsg, probleme); return null; }
      occupe(true);
      const res = await sauver();
      if (!vue.isConnected) return null;
      occupe(false);
      if (!res.ok) { message(zoneMsg, res.error.message); return null; }
      return res;
    };

    const bouton = (selecteur, action) => {
      const el = form.querySelector(selecteur);
      if (el) el.addEventListener('click', action);
    };

    bouton('#precedent', async () => {
      if (await enregistrer()) { etat.etape -= 1; dessiner(); }
    });
    bouton('#suivant', async () => {
      if (await enregistrer()) { etat.etape += 1; dessiner(); }
    });
    bouton('#brouillon', async () => {
      if (await enregistrer()) message(zoneMsg, 'Brouillon enregistré.', 'succes');
    });
    bouton('#soumettre', async () => {
      const sauve = await enregistrer();
      if (!sauve) return;
      occupe(true);
      const res = await requete(`/conventions/${etat.id}/soumettre`, { method: 'POST' });
      if (!vue.isConnected) return;

      if (res.ok) { location.hash = `#conventions/${etat.id}`; return; }

      occupe(false);
      // Champs obligatoires manquants : retour à la première étape concernée
      if (res.error.code === 'INCOMPLETE' && Array.isArray(res.error.manquants)) {
        const manquants = res.error.manquants;
        etat.etape = Math.min(...manquants.map((m) => ETAPE_DU_CHAMP[m] ?? 0));
        const noms = [...new Set(manquants.map((m) => LIBELLE_CHAMP[m] || m))].join(', ');
        dessiner(`Convention incomplète. Champs à renseigner : ${noms}.`);
        return;
      }
      message(zoneMsg, res.error.message);
    });
  };

  dessiner();
}