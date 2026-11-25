-- Seed de démonstration des conventions (rejouable sans doublons)
-- Comptes du socle : 2 = responsable (encadrant), 3-7 = étudiants, 8-10 = entreprises (tuteurs)

DO $$
DECLARE
  d RECORD;
  v_stage_id INT;
  v_conv_id  INT;
BEGIN
  FOR d IN
    SELECT * FROM (VALUES
      -- etudiant, entreprise(=tuteur), encadrant, origine, sujet, missions, gratif, debut, fin, statut, motif
      (3, 8,  NULL::int, 'initiative_etudiant', 'Application de suivi logistique', NULL,
        NULL::numeric, NULL::date, NULL::date, 'brouillon', NULL),
      (4, 9,  2, 'envoi_departement', 'Plateforme de vente en ligne',
        'Developpement du catalogue, du panier et des paiements mobiles.',
        75000, DATE '2027-02-01', DATE '2027-07-31', 'soumise', NULL),
      (5, 10, 2, 'demande_entreprise', 'Outil de gestion de la relation client',
        'Analyse des besoins, developpement d''un CRM et formation des equipes.',
        100000, DATE '2027-01-15', DATE '2027-06-30', 'validee', NULL),
      (6, 8,  2, 'initiative_etudiant', 'Tableau de bord statistique',
        'Collecte des donnees et realisation de tableaux de bord.',
        50000, DATE '2027-03-01', DATE '2027-08-31', 'a_corriger',
        'Preciser les missions et la periode de stage.'),
      (7, 9,  2, 'initiative_etudiant', 'Site vitrine de l''entreprise',
        'Conception et mise en ligne du site web.',
        25000, DATE '2027-02-15', DATE '2027-05-15', 'refusee',
        'Duree insuffisante pour un stage de fin d''annee.')
    ) AS t(etudiant, entreprise, encadrant, origine, sujet, missions, gratif, debut, fin, statut, motif)
  LOOP
    -- Ignore la ligne si l'étudiant n'existe pas ou a déjà un stage actif
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM utilisateurs WHERE id = d.etudiant);
    CONTINUE WHEN EXISTS (SELECT 1 FROM stages WHERE etudiant_id = d.etudiant AND statut = 'actif');

    INSERT INTO stages (etudiant_id, entreprise_id, tuteur_id, encadrant_id, origine,
                        sujet, missions, gratification, date_debut, date_fin)
    VALUES (
      d.etudiant,
      (SELECT id FROM entreprises WHERE utilisateur_id = d.entreprise),
      d.entreprise, d.encadrant, d.origine,
      d.sujet, d.missions, d.gratif, d.debut, d.fin
    )
    RETURNING id INTO v_stage_id;

    INSERT INTO conventions (stage_id, statut, motif, soumise_le)
    VALUES (v_stage_id, d.statut, d.motif,
            CASE WHEN d.statut = 'brouillon' THEN NULL ELSE now() END)
    RETURNING id INTO v_conv_id;

    -- Historique : création en brouillon, puis soumission, puis décision
    INSERT INTO convention_historique (convention_id, ancien_statut, nouveau_statut, change_par, commentaire)
    VALUES (v_conv_id, NULL, 'brouillon', d.etudiant, 'Creation du brouillon');

    IF d.statut <> 'brouillon' THEN
      INSERT INTO convention_historique (convention_id, ancien_statut, nouveau_statut, change_par, commentaire)
      VALUES (v_conv_id, 'brouillon', 'soumise', d.etudiant, 'Soumission de la convention');
    END IF;

    IF d.statut IN ('validee', 'refusee', 'a_corriger') THEN
      INSERT INTO convention_historique (convention_id, ancien_statut, nouveau_statut, change_par, commentaire)
      VALUES (v_conv_id, 'soumise', d.statut, 2, d.motif);
    END IF;
  END LOOP;
END $$;