-- Insertion des comptes utilisateurs de base avec des noms sénégalais
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role_id) VALUES
('Diallo', 'Mamadou', 'admin@gestion-stages.sn', 'password123', (SELECT id FROM roles WHERE nom = 'admin')),
('Ndiaye', 'Aissatou', 'responsable@gestion-stages.sn', 'password123', (SELECT id FROM roles WHERE nom = 'responsable')),
('Faye', 'Cheikh', 'cheikh.faye@etudiant.sn', 'password123', (SELECT id FROM roles WHERE nom = 'etudiant')),
('Diop', 'Fatou', 'fatou.diop@etudiant.sn', 'password123', (SELECT id FROM roles WHERE nom = 'etudiant')),
('Sow', 'Ousmane', 'ousmane.sow@etudiant.sn', 'password123', (SELECT id FROM roles WHERE nom = 'etudiant')),
('Ba', 'Aminata', 'aminata.ba@etudiant.sn', 'password123', (SELECT id FROM roles WHERE nom = 'etudiant')),
('Cisse', 'Abdoulaye', 'abdoulaye.cisse@etudiant.sn', 'password123', (SELECT id FROM roles WHERE nom = 'etudiant')),
('Tech', 'Senegal Solutions', 'contact@senegalsolutions.sn', 'password123', (SELECT id FROM roles WHERE nom = 'entreprise')),
('Dakar', 'Digital Hub', 'rh@dakardigitalhub.sn', 'password123', (SELECT id FROM roles WHERE nom = 'entreprise')),
('Teranga', 'Software', 'contact@terangasoftware.sn', 'password123', (SELECT id FROM roles WHERE nom = 'entreprise'))
ON CONFLICT (email) DO NOTHING;

-- Insertion des 5 étudiants (liés aux utilisateurs correspondants)
INSERT INTO etudiants (utilisateur_id, filiere, niveau) VALUES
((SELECT id FROM utilisateurs WHERE email = 'cheikh.faye@etudiant.sn'), 'Génie Informatique', 'Licence 3'),
((SELECT id FROM utilisateurs WHERE email = 'fatou.diop@etudiant.sn'), '2GL (Génie Logiciel)', 'Master 2'),
((SELECT id FROM utilisateurs WHERE email = 'ousmane.sow@etudiant.sn'), 'Réseaux et Télécommunications', 'Licence 3'),
((SELECT id FROM utilisateurs WHERE email = 'aminata.ba@etudiant.sn'), 'Marketing Digital', 'Master 1'),
((SELECT id FROM utilisateurs WHERE email = 'abdoulaye.cisse@etudiant.sn'), 'Sécurité Informatique', 'Master 2')
ON CONFLICT DO NOTHING;

-- Insertion des 3 entreprises (liées aux utilisateurs correspondants)
INSERT INTO entreprises (utilisateur_id, raison_sociale, secteur_activite, adresse) VALUES
((SELECT id FROM utilisateurs WHERE email = 'contact@senegalsolutions.sn'), 'Senegal Solutions', 'Technologies & Services', 'Avenue Bourguiba, Dakar'),
((SELECT id FROM utilisateurs WHERE email = 'rh@dakardigitalhub.sn'), 'Dakar Digital Hub', 'Innovation Numérique', 'Almadies, Dakar'),
((SELECT id FROM utilisateurs WHERE email = 'contact@terangasoftware.sn'), 'Teranga Software', 'Développement Logiciel', 'Point E, Dakar')
ON CONFLICT DO NOTHING;

-- Insertion de quelques notifications de test
INSERT INTO notifications (utilisateur_id, message, lien) VALUES
((SELECT id FROM utilisateurs WHERE email = 'cheikh.faye@etudiant.sn'), 'Bienvenue sur la plateforme de gestion des stages.', '/stages'),
((SELECT id FROM utilisateurs WHERE email = 'contact@senegalsolutions.sn'), 'Votre compte entreprise a été validé avec succès.', '/profil');