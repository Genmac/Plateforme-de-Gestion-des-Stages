const { parse: parseCsv } = require("csv-parse/sync");
const db = require("../config/db");
const svc = require("../services/compteService");

const MAX_LIGNES_IMPORT = 500;
const { erreur, gerer } = svc;

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    throw erreur(400, "VALIDATION_ERROR", "Identifiant invalide.");
  return id;
};

/** GET /api/utilisateurs?q=&role=&statut=&page=&limite= */
const lister = gerer(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const role =
    String(req.query.role || "")
      .trim()
      .toLowerCase() || null;
  const statut =
    String(req.query.statut || "")
      .trim()
      .toLowerCase() || null;
  if (role && !svc.ROLES.includes(role))
    throw erreur(
      400,
      "VALIDATION_ERROR",
      `role : valeur invalide (${svc.ROLES.join(", ")})`,
    );
  if (statut && !svc.STATUTS.includes(statut))
    throw erreur(
      400,
      "VALIDATION_ERROR",
      "statut : valeur invalide (actif, desactive)",
    );
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limite = Math.min(
    100,
    Math.max(1, parseInt(req.query.limite, 10) || 20),
  );
  const motif = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;

  const { rows } = await db.query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.statut, u.premiere_connexion,
            u.derniere_connexion, u.created_at, r.nom AS role, COUNT(*) OVER() AS total
       FROM utilisateurs u LEFT JOIN roles r ON r.id = u.role_id
      WHERE ($1::text IS NULL OR u.nom ILIKE $1 OR u.prenom ILIKE $1 OR u.email ILIKE $1
             OR (u.prenom || ' ' || u.nom) ILIKE $1)
        AND ($2::text IS NULL OR r.nom = $2)
        AND ($3::text IS NULL OR u.statut = $3)
      ORDER BY u.nom, u.prenom, u.id
      LIMIT $4 OFFSET $5`,
    [motif, role, statut, limite, (page - 1) * limite],
  );

  const total = rows.length ? Number(rows[0].total) : 0;
  res.status(200).json({
    success: true,
    data: rows.map(({ total: _t, ...u }) => u),
    meta: { total, page, limite },
  });
});

/** GET /api/utilisateurs/options/entreprises (liste pour rattacher un tuteur) */
const optionsEntreprises = gerer(async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, raison_sociale FROM entreprises ORDER BY raison_sociale",
  );
  res.status(200).json({ success: true, data: rows });
});

/** GET /api/utilisateurs/:id */
const obtenir = gerer(async (req, res) => {
  res
    .status(200)
    .json({ success: true, data: await svc.chargerUtilisateur(idParam(req)) });
});

/** POST /api/utilisateurs */
const creer = gerer(async (req, res) => {
  const donnees = svc.validerNouveauCompte(req.body);
  const cree = await svc.transaction((client) =>
    svc.creerCompte(client, donnees),
  );
  res.status(201).json({
    success: true,
    message:
      "Compte créé. Le mot de passe temporaire doit être changé à la première connexion.",
    data: {
      utilisateur: await svc.chargerUtilisateur(cree.id),
      mot_de_passe_temporaire: cree.mot_de_passe_temporaire, // affiché une seule fois
    },
  });
});

/**
 * Change le rôle dans la transaction `c` : supprime l'ancien profil, met à jour role_id, crée le nouveau profil.
 * Partagé par PUT /:id (champ `role`) et PATCH /:id/role.
 */
async function appliquerChangementRole(c, id, ancienRole, nouveauRole, profil) {
  if (nouveauRole === "entreprise")
    await svc.verifierEntreprise(c, profil.entreprise_id);
  const ancienne = svc.PROFILS[ancienRole];
  if (ancienne && ancienne.table) {
    await c.query(`DELETE FROM ${ancienne.table} WHERE utilisateur_id = $1`, [
      id,
    ]);
  }
  await c.query(
    "UPDATE utilisateurs SET role_id = (SELECT id FROM roles WHERE nom = $1), updated_at = NOW() WHERE id = $2",
    [nouveauRole, id],
  );
  await svc.insererProfil(c, nouveauRole, id, profil);
}

/**
 * PUT /api/utilisateurs/:id — modification partielle, en une seule transaction :
 *   nom, prenom, email, role (optionnel), profil.
 * Si `role` est différent du rôle actuel, `profil` est le profil COMPLET du nouveau rôle.
 * Sinon, `profil` ne contient que les champs à modifier.
 */
const modifier = gerer(async (req, res) => {
  const id = idParam(req);
  const {
    champs,
    profilBrut,
    role: roleDemande,
  } = svc.validerModification(req.body);

  await svc.transaction(async (c) => {
    const cur = await c.query(
      `SELECT r.nom AS role FROM utilisateurs u LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 FOR UPDATE OF u`,
      [id],
    );
    if (!cur.rowCount)
      throw erreur(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
    const roleActuel = cur.rows[0].role;
    const changeRole = roleDemande !== undefined && roleDemande !== roleActuel;
    if (changeRole && id === req.utilisateur.id) {
      throw erreur(
        400,
        "SELF_ACTION",
        "Vous ne pouvez pas changer votre propre rôle.",
      );
    }

    const entrees = Object.entries(champs);
    if (entrees.length) {
      await c.query(
        `UPDATE utilisateurs SET ${entrees.map(([k], i) => `${k} = $${i + 1}`).join(", ")}, updated_at = NOW()
          WHERE id = $${entrees.length + 1}`,
        [...entrees.map(([, v]) => v), id],
      );
    }

    if (changeRole) {
      const v = new svc.Validateur();
      const profil = svc.validerProfil(v, roleDemande, profilBrut);
      v.verifier();
      await appliquerChangementRole(c, id, roleActuel, roleDemande, profil);
    } else if (profilBrut !== undefined) {
      const def = svc.PROFILS[roleActuel];
      if (!def || !def.table)
        throw erreur(
          400,
          "VALIDATION_ERROR",
          "Ce rôle n'a pas de profil modifiable.",
        );
      const v = new svc.Validateur();
      const p = svc.validerProfil(v, roleActuel, profilBrut, true);
      v.verifier();
      const cp = Object.entries(p);
      if (cp.length) {
        if (roleActuel === "entreprise" && p.entreprise_id)
          await svc.verifierEntreprise(c, p.entreprise_id);
        const r = await c.query(
          `UPDATE ${def.table} SET ${cp.map(([k], i) => `${k} = $${i + 1}`).join(", ")}
            WHERE utilisateur_id = $${cp.length + 1}`,
          [...cp.map(([, val]) => val), id],
        );
        if (!r.rowCount) {
          throw erreur(
            409,
            "PROFILE_MISSING",
            "Profil absent : indiquez un rôle et son profil complet pour le créer.",
          );
        }
      }
    }
  });
  res
    .status(200)
    .json({ success: true, data: await svc.chargerUtilisateur(id) });
});

/** PATCH /api/utilisateurs/:id/role  { role, profil } (équivalent à PUT avec seulement `role`) */
const changerRole = gerer(async (req, res) => {
  const id = idParam(req);
  if (id === req.utilisateur.id)
    throw erreur(
      400,
      "SELF_ACTION",
      "Vous ne pouvez pas changer votre propre rôle.",
    );

  const v = new svc.Validateur();
  const nouveauRole = v.choix(req.body?.role, "role", svc.ROLES);
  const profil = nouveauRole
    ? svc.validerProfil(v, nouveauRole, req.body?.profil)
    : {};
  v.verifier();

  await svc.transaction(async (c) => {
    const cur = await c.query(
      `SELECT r.nom AS role FROM utilisateurs u LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 FOR UPDATE OF u`,
      [id],
    );
    if (!cur.rowCount)
      throw erreur(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
    const ancienRole = cur.rows[0].role;
    if (ancienRole === nouveauRole)
      throw erreur(400, "SAME_ROLE", "L'utilisateur a déjà ce rôle.");
    await appliquerChangementRole(c, id, ancienRole, nouveauRole, profil);
  });
  res
    .status(200)
    .json({ success: true, data: await svc.chargerUtilisateur(id) });
});

/** PATCH /api/utilisateurs/:id/desactiver | /activer */
const changerStatut = (statut) =>
  gerer(async (req, res) => {
    const id = idParam(req);
    if (statut === "desactive" && id === req.utilisateur.id) {
      throw erreur(
        400,
        "SELF_ACTION",
        "Vous ne pouvez pas désactiver votre propre compte.",
      );
    }
    const r = await db.query(
      "UPDATE utilisateurs SET statut = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
      [statut, id],
    );
    if (!r.rowCount)
      throw erreur(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
    res
      .status(200)
      .json({ success: true, data: await svc.chargerUtilisateur(id) });
  });

/** POST /api/utilisateurs/import-etudiants (multipart, champ "fichier") */
const importerEtudiants = gerer(async (req, res) => {
  if (!req.file)
    throw erreur(
      400,
      "FILE_MISSING",
      "Joignez un fichier CSV (champ « fichier »).",
    );

  const contenu = req.file.buffer.toString("utf8").replace(/^\uFEFF/, "");
  const entete = contenu.split(/\r?\n/)[0] || "";
  const delimiter =
    entete.split(";").length > entete.split(",").length ? ";" : ",";

  let lignes;
  try {
    lignes = parseCsv(contenu, {
      columns: (h) => h.map((x) => String(x).trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      delimiter,
    });
  } catch (e) {
    throw erreur(400, "CSV_INVALID", `Fichier CSV illisible : ${e.message}`);
  }
  if (!lignes.length)
    throw erreur(
      400,
      "CSV_EMPTY",
      "Le fichier ne contient aucune ligne de données.",
    );
  if (lignes.length > MAX_LIGNES_IMPORT)
    throw erreur(
      400,
      "CSV_TOO_LONG",
      `Maximum ${MAX_LIGNES_IMPORT} lignes par import.`,
    );
  const manquantes = ["nom", "prenom", "email"].filter(
    (c) => !(c in lignes[0]),
  );
  if (manquantes.length) {
    throw erreur(
      400,
      "CSV_MISSING_COLUMNS",
      `Colonnes obligatoires absentes : ${manquantes.join(", ")}. En-tête attendu : nom,prenom,email,filiere,niveau`,
    );
  }

  const comptes = [];
  const erreurs = [];
  // Une transaction par ligne : une ligne en erreur ne bloque pas les autres.
  for (let i = 0; i < lignes.length; i += 1) {
    const numero = i + 2; // +1 pour l'en-tête, +1 pour compter à partir de 1
    const l = lignes[i];
    try {
      const donnees = svc.validerNouveauCompte({
        nom: l.nom,
        prenom: l.prenom,
        email: l.email,
        role: "etudiant",
        profil: { filiere: l.filiere, niveau: l.niveau },
      });
      // eslint-disable-next-line no-await-in-loop
      const cree = await svc.transaction((client) =>
        svc.creerCompte(client, donnees),
      );
      comptes.push({
        ligne: numero,
        nom: donnees.nom,
        prenom: donnees.prenom,
        email: donnees.email,
        mot_de_passe_temporaire: cree.mot_de_passe_temporaire,
      });
    } catch (e) {
      const t = svc.traduireErreurPg(e);
      if (!t.statusCode) throw e; // erreur inattendue : on remonte
      erreurs.push({ ligne: numero, email: l.email || "", motif: t.message });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      total_lignes: lignes.length,
      crees: comptes.length,
      comptes,
      erreurs,
    },
  });
});

module.exports = {
  lister,
  optionsEntreprises,
  obtenir,
  creer,
  modifier,
  changerRole,
  desactiver: changerStatut("desactive"),
  activer: changerStatut("actif"),
  importerEtudiants,
};
