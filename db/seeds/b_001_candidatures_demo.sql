-- Seed de démonstration (rejouable sans doublons)
-- Suppose que l'utilisateur 3 (Cheikh Faye, étudiant) existe déjà (seed du socle).

INSERT INTO entreprises (raison_sociale, secteur_activite, adresse, contact_nom, contact_email, statut)
SELECT 'Sonatel', 'Telecom', 'Dakar, Plateau', 'Service RH', 'rh@exemple.sn', 'validee'
WHERE NOT EXISTS (SELECT 1 FROM entreprises WHERE raison_sociale = 'Sonatel');

INSERT INTO entreprises (raison_sociale, secteur_activite, adresse, contact_nom, statut, proposee_par)
SELECT 'Startup Demo SARL', 'Numerique', 'Diamniadio', 'M. Fall', 'a_valider', 3
WHERE NOT EXISTS (SELECT 1 FROM entreprises WHERE raison_sociale = 'Startup Demo SARL')
  AND EXISTS (SELECT 1 FROM utilisateurs WHERE id = 3);

INSERT INTO candidatures (etudiant_id, entreprise_id, poste, contact, statut)
SELECT 3, e.id, 'Stagiaire développeur', 'Service RH', 'envoyee'
FROM entreprises e
WHERE e.raison_sociale = 'Sonatel'
  AND EXISTS (SELECT 1 FROM utilisateurs WHERE id = 3)
  AND NOT EXISTS (SELECT 1 FROM candidatures c WHERE c.etudiant_id = 3 AND c.entreprise_id = e.id);