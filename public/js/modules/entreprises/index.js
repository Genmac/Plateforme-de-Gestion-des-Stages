import { manifest } from './manifest.js';
import { session } from '../../core/session.js';
import { afficherEntreprises } from './entreprises.js';
import { afficherCandidatures } from './candidatures.js';

/*
 * Point d'entrée du module B. Routes gérées :
 *   #entreprises                              liste, recherche, formulaire, validation
 *   #entreprises/candidatures                 « Mes candidatures »
 *   #entreprises/candidatures/<id>            détail d'une candidature
 *   #entreprises/candidatures/nouvelle[/<id>] nouveau formulaire (entreprise présélectionnée)
 */

function lireRoute() {
  const [racine, section, a, b] = location.hash.slice(1).split('/');
  return { racine, section, a, b };
}

async function rendre() {
  const { racine, section, a, b } = lireRoute();
  if (`#${racine}` !== manifest.route) return; // une autre route : ce n'est pas notre module

  const zone = document.getElementById('app-content');
  if (!zone) return;

  // La zone du socle est étroite (max-w-4xl) : on l'élargit pour les tableaux
  zone.classList.remove('max-w-4xl');
  zone.classList.add('max-w-6xl');

  const role = session.getCurrentRole();
  if (!manifest.roles.includes(role)) {
    zone.innerHTML = `
      <div class="bg-white p-6 rounded-xl border border-slate-200 text-sm text-slate-600">
        Ce module n'est pas accessible avec votre rôle.
      </div>`;
    return;
  }

  const surCandidatures = section === 'candidatures';
  const actif = 'border-b-2 border-indigo-600 text-indigo-700';
  const inactif = 'text-slate-500 hover:text-slate-800';
  zone.innerHTML = `
    <div class="flex gap-6 border-b border-slate-200 mb-6">
      <a href="#entreprises" class="pb-3 text-sm font-medium ${surCandidatures ? inactif : actif}">Entreprises</a>
      <a href="#entreprises/candidatures" class="pb-3 text-sm font-medium ${surCandidatures ? actif : inactif}">
        ${role === 'etudiant' ? 'Mes candidatures' : 'Candidatures'}
      </a>
    </div>
    <div id="module-vue"></div>`;

  // Chaque rendu crée une zone neuve : si l'utilisateur navigue pendant un chargement,
  // l'ancienne zone n'est plus dans la page (isConnected = false) et ses réponses sont ignorées.
  const vue = zone.querySelector('#module-vue');
  try {
    if (surCandidatures) {
      await afficherCandidatures(vue, role, {
        id: a && /^\d+$/.test(a) ? a : null,
        nouvelle: a === 'nouvelle',
        entrepriseId: b && /^\d+$/.test(b) ? b : null
      });
    } else {
      await afficherEntreprises(vue, role);
    }
  } catch (err) {
    console.error('Module entreprises :', err);
    if (vue.isConnected) {
      vue.innerHTML = `<div class="px-4 py-3 rounded-lg border bg-red-50 text-red-800 border-red-200 text-sm">
        Une erreur est survenue à l'affichage de cette page.</div>`;
    }
  }
}

window.addEventListener('hashchange', rendre);

// Changement de compte DEV_AUTH : on réaffiche avec le nouveau rôle
// (setTimeout : laisse d'abord s'exécuter le gestionnaire du socle qui met la session à jour)
const selecteurCompte = document.getElementById('dev-user-select');
if (selecteurCompte) {
  selecteurCompte.addEventListener('change', () => setTimeout(rendre, 0));
}

rendre();