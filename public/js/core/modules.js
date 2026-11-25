import comptesManifest from "../modules/comptes/manifest.js";

export const modulesManifest = [
  // Socle commun
  {
    id: "accueil",
    label: "Tableau de bord",
    route: "#accueil",
    roles: ["admin", "responsable", "etudiant", "entreprise"],
  },

  // Module A (Comptes & Utilisateurs)
  comptesManifest,

  // Module B (Entreprises & Candidatures) — à activer après l'issue socle
  // { id: 'entreprises', label: 'Entreprises & Offres', route: '#entreprises', roles: ['admin', 'responsable', 'etudiant', 'entreprise'] },

  // Module C (Stages & Conventions) — à activer après l'issue socle
  // { id: 'conventions', label: 'Conventions', route: '#conventions', roles: ['admin', 'responsable', 'etudiant', 'entreprise'] }
];
