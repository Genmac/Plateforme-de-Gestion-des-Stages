-- c_001_conventions.sql
-- Idempotent : rejouable sans erreur (migrate.js rejoue tous les fichiers)

-- 1) Stages
CREATE TABLE IF NOT EXISTS stages (
  id              SERIAL PRIMARY KEY,
  etudiant_id     INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  entreprise_id   INT REFERENCES entreprises(id) ON DELETE SET NULL,
  tuteur_id       INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  encadrant_id    INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  -- Lien par identifiant, volontairement SANS clé étrangère : le module C
  -- doit fonctionner sans le module B (candidature facultative)
  candidature_id  INT,
  origine         VARCHAR(30) NOT NULL DEFAULT 'initiative_etudiant'
      CHECK (origine IN ('initiative_etudiant', 'envoi_departement', 'demande_entreprise')),
  sujet           VARCHAR(255),
  missions        TEXT,
  gratification   NUMERIC(12,2) CHECK (gratification IS NULL OR gratification >= 0),
  date_debut      DATE,
  date_fin        DATE,
  statut          VARCHAR(20) NOT NULL DEFAULT 'actif'
      CHECK (statut IN ('actif', 'termine', 'annule')),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_stages_dates
    CHECK (date_debut IS NULL OR date_fin IS NULL OR date_fin > date_debut)
);

-- Un seul stage actif par étudiant (garanti en base, même en cas de requêtes simultanées)
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_actif_par_etudiant
  ON stages (etudiant_id) WHERE statut = 'actif';

CREATE INDEX IF NOT EXISTS idx_stages_tuteur    ON stages (tuteur_id);
CREATE INDEX IF NOT EXISTS idx_stages_encadrant ON stages (encadrant_id);

-- 2) Conventions (une par stage)
CREATE TABLE IF NOT EXISTS conventions (
  id          SERIAL PRIMARY KEY,
  stage_id    INT NOT NULL UNIQUE REFERENCES stages(id) ON DELETE CASCADE,
  statut      VARCHAR(20) NOT NULL DEFAULT 'brouillon'
      CHECK (statut IN ('brouillon', 'soumise', 'validee', 'refusee', 'a_corriger')),
  motif       TEXT,
  soumise_le  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3) Historique de chaque changement de statut
CREATE TABLE IF NOT EXISTS convention_historique (
  id             SERIAL PRIMARY KEY,
  convention_id  INT NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  ancien_statut  VARCHAR(20),
  nouveau_statut VARCHAR(20) NOT NULL,
  change_par     INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  commentaire    TEXT,
  change_le      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conv_histo ON convention_historique (convention_id);