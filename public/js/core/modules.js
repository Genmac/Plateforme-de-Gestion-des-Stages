import { manifest as entreprises } from '../modules/entreprises/manifest.js';

export const modulesManifest = [
  // Socle commun
  { id: 'accueil', label: 'Tableau de bord', route: '#accueil', roles: ['admin', 'responsable', 'etudiant', 'entreprise'] },

  // Module A (Comptes & Utilisateurs) — à activer après l'issue socle
  // { id: 'comptes', label: 'Utilisateurs', route: '#comptes', roles: ['admin', 'responsable'] },

  // Module B (Entreprises & Candidatures)
  entreprises,

  // Module C (Stages & Conventions) — à activer après l'issue socle
  // { id: 'conventions', label: 'Conventions', route: '#conventions', roles: ['admin', 'responsable', 'etudiant', 'entreprise'] }
];