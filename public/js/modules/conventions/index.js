import { manifest } from './manifest.js';
import { session } from '../../core/session.js';
import { afficherListe } from './liste.js';
import { afficherFormulaire } from './formulaire.js';
import { afficherFiche } from './fiche.js';

/*
 * Routes du module C :
 *   #conventions                liste (selon le rôle)
 *   #conventions/nouvelle       formulaire en étapes (création)
 *   #conventions/<id>           fiche : statut, informations, historique
 *   #conventions/<id>/modifier  reprise d'un brouillon ou d'une convention à corriger
 */

async function rendre() {
  const [racine, a, b] = location.hash.slice(1).split('/');
  if (`#${racine}` !== manifest.route) return; // une autre route : pas notre module

  const zone = document.getElementById('app-content');
  if (!zone) return;
  zone.classList.remove('max-w-4xl');
  zone.classList.add('max-w-6xl');

  const role = session.getCurrentRole();
  if (!manifest.roles.includes(role)) {
    zone.innerHTML = `<div class="bg-white p-6 rounded-xl border border-slate-200 text-sm text-slate-600">
      Ce module n'est pas accessible avec votre rôle.</div>`;
    return;
  }

  // Zone neuve à chaque rendu : si l'utilisateur navigue pendant un chargement,
  // l'ancienne zone n'est plus dans la page (isConnected = false) et ses réponses sont ignorées.
  zone.innerHTML = '<div id="module-vue"></div>';
  const vue = zone.querySelector('#module-vue');

  try {
    if (a === 'nouvelle') await afficherFormulaire(vue, role, null);
    else if (a && /^\d+$/.test(a) && b === 'modifier') await afficherFormulaire(vue, role, a);
    else if (a && /^\d+$/.test(a)) await afficherFiche(vue, role, a);
    else await afficherListe(vue, role);
  } catch (err) {
    console.error('Module conventions :', err);
    if (vue.isConnected) {
      vue.innerHTML = `<div class="px-4 py-3 rounded-lg border bg-red-50 text-red-800 border-red-200 text-sm">
        Une erreur est survenue à l'affichage de cette page.</div>`;
    }
  }
}

window.addEventListener('hashchange', rendre);

// Changement de compte DEV_AUTH : on réaffiche avec le nouveau rôle
const selecteurCompte = document.getElementById('dev-user-select');
if (selecteurCompte) selecteurCompte.addEventListener('change', () => setTimeout(rendre, 0));

rendre();