-- Création de la table des rôles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des rôles de base par défaut
INSERT INTO roles (nom, description) VALUES 
('admin', 'Administrateur de la plateforme'),
('responsable', 'Responsable des stages'),
('etudiant', 'Étudiant cherchant un stage'),
('entreprise', 'Maître de stage / Entreprise d''accueil')
ON CONFLICT (nom) DO NOTHING;

-- Création de la table des utilisateurs
CREATE TABLE IF NOT EXISTS utilisateurs (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table minimale des étudiants (liée à un utilisateur)
CREATE TABLE IF NOT EXISTS etudiants (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
    filiere VARCHAR(100),
    niveau VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table minimale des entreprises (liée à un utilisateur)
CREATE TABLE IF NOT EXISTS entreprises (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
    raison_sociale VARCHAR(255) NOT NULL,
    secteur_activite VARCHAR(100),
    adresse TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table des notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT REFERENCES utilisateurs(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    lien VARCHAR(255),
    lu BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);