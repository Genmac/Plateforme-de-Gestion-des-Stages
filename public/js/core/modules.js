import { manifest as entreprises } from '../modules/entreprises/manifest.js'; // Module B
import { manifest as conventions } from '../modules/conventions/manifest.js';

export const modulesManifest = [
  // Socle commun
  { id: 'accueil', label: 'Tableau de bord', route: '#accueil', roles: ['admin', 'responsable', 'etudiant', 'entreprise'] },

  // Module A (Comptes & Utilisateurs) — à activer après l'issue socle
  // { id: 'comptes', label: 'Utilisateurs', route: '#comptes', roles: ['admin', 'responsable'] },

  // Module B (Entreprises & Candidatures)
  entreprises, // Module B

  // Module C (Stages & Conventions)
  conventions
];