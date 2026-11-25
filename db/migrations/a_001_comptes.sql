-- MODULE A : comptes et acces
-- Complete `utilisateurs` (statut, premiere connexion, derniere connexion) et cree `tuteurs`.

ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS statut VARCHAR(20) NOT NULL DEFAULT 'actif',
    ADD COLUMN IF NOT EXISTS premiere_connexion BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMP;

-- Statut : 'actif' ou 'desactive'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_utilisateurs_statut') THEN
        ALTER TABLE utilisateurs
            ADD CONSTRAINT chk_utilisateurs_statut CHECK (statut IN ('actif', 'desactive'));
    END IF;
END $$;

-- Tuteur : compte utilisateur (role 'entreprise') rattache a une entreprise
CREATE TABLE IF NOT EXISTS tuteurs (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
    entreprise_id INT NOT NULL REFERENCES entreprises(id) ON DELETE RESTRICT,
    fonction VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tuteurs_entreprise ON tuteurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON utilisateurs(role_id);