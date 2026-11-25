-- b_001_entreprises_candidatures.sql
-- Idempotent : peut être rejoué sans erreur (migrate.js rejoue tous les fichiers)

-- 1) Compléter la table entreprises (existe déjà dans 000_socle.sql)
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS contact_nom       VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contact_email     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_telephone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS site_web          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS statut            VARCHAR(20) NOT NULL DEFAULT 'validee'
      CHECK (statut IN ('a_valider', 'validee', 'rejetee')),
  ADD COLUMN IF NOT EXISTS proposee_par      INT REFERENCES utilisateurs(id) ON DELETE SET NULL;

-- Recherche par nom et détection de doublon (alerte, donc pas de UNIQUE)
CREATE INDEX IF NOT EXISTS idx_entreprises_nom_lower
  ON entreprises (lower(raison_sociale));

-- 2) Candidatures
CREATE TABLE IF NOT EXISTS candidatures (
  id               SERIAL PRIMARY KEY,
  etudiant_id      INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  entreprise_id    INT NOT NULL REFERENCES entreprises(id),
  poste            VARCHAR(150) NOT NULL,
  contact          VARCHAR(150),
  date_candidature DATE NOT NULL DEFAULT CURRENT_DATE,
  statut           VARCHAR(20) NOT NULL DEFAULT 'envoyee'
      CHECK (statut IN ('envoyee','en_attente','entretien','acceptee','refusee','retiree')),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_candidatures_etudiant ON candidatures (etudiant_id);

-- 3) Historique daté des statuts
CREATE TABLE IF NOT EXISTS candidature_historique (
  id             SERIAL PRIMARY KEY,
  candidature_id INT NOT NULL REFERENCES candidatures(id) ON DELETE CASCADE,
  ancien_statut  VARCHAR(20),
  nouveau_statut VARCHAR(20) NOT NULL,
  change_par     INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  change_le      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4) Documents (CV, lettre, preuve d'acceptation)
CREATE TABLE IF NOT EXISTS candidature_documents (
  id             SERIAL PRIMARY KEY,
  candidature_id INT NOT NULL REFERENCES candidatures(id) ON DELETE CASCADE,
  type           VARCHAR(30) NOT NULL
      CHECK (type IN ('cv','lettre','preuve_acceptation')),
  nom_original   VARCHAR(255) NOT NULL,
  chemin         VARCHAR(500) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  taille         INT NOT NULL,
  depose_le      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_docs_candidature ON candidature_documents (candidature_id);