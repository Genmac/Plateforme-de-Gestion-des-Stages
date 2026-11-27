const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../config/db");

const ROLES = ["admin", "responsable", "etudiant", "entreprise"];
const STATUTS = ["actif", "desactive"];
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 8 caractères minimum, une lettre et un chiffre (72 = limite de bcrypt)
const REGEX_MDP = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const MESSAGE_MDP =
  "nouveau_mot_de_passe : 8 caractères minimum, dont au moins une lettre et un chiffre.";

const rounds = () => Number(process.env.BCRYPT_ROUNDS) || 10;

/** Erreur reconnue par le middleware centralisé (statusCode + code + message). */
const erreur = (statusCode, code, message) =>
  Object.assign(new Error(message), { statusCode, code });

/** Convertit les erreurs PostgreSQL courantes en erreurs API lisibles. */
function traduireErreurPg(e) {
  if (e && e.code === "23505") {
    const c = `${e.constraint || ""}`;
    return c.includes("email")
      ? erreur(409, "EMAIL_ALREADY_EXISTS", "Cet e-mail est déjà utilisé.")
      : erreur(409, "ALREADY_EXISTS", "Cette valeur existe déjà.");
  }
  if (e && e.code === "23503") {
    return erreur(
      409,
      "REFERENCE_CONFLICT",
      "Opération impossible : ce compte est lié à d'autres données.",
    );
  }
  return e;
}

/** Enveloppe un handler async (Express 4) et traduit les erreurs PostgreSQL. */
const gerer = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => next(traduireErreurPg(e)));

async function transaction(fn) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const resultat = await fn(client);
    await client.query("COMMIT");
    return resultat;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- validation
class Validateur {
  constructor() {
    this.erreurs = [];
  }
  texte(valeur, champ, { max = 100, requis = false } = {}) {
    if (
      valeur === undefined ||
      valeur === null ||
      (typeof valeur === "string" && valeur.trim() === "")
    ) {
      if (requis) this.erreurs.push(`${champ} : obligatoire`);
      return null;
    }
    if (typeof valeur !== "string") {
      this.erreurs.push(`${champ} : texte attendu`);
      return null;
    }
    const v = valeur.trim();
    if (v.length > max) {
      this.erreurs.push(`${champ} : ${max} caractères maximum`);
      return null;
    }
    return v;
  }
  email(valeur, champ = "email") {
    const v = this.texte(
      typeof valeur === "string" ? valeur.toLowerCase() : valeur,
      champ,
      { max: 255, requis: true },
    );
    if (v && !REGEX_EMAIL.test(v)) {
      this.erreurs.push(`${champ} : e-mail invalide`);
      return null;
    }
    return v;
  }
  choix(valeur, champ, liste) {
    const v = typeof valeur === "string" ? valeur.trim().toLowerCase() : "";
    if (!liste.includes(v)) {
      this.erreurs.push(`${champ} : valeur invalide (${liste.join(", ")})`);
      return null;
    }
    return v;
  }
  identifiant(valeur, champ, { requis = false } = {}) {
    if (valeur === undefined || valeur === null || valeur === "") {
      if (requis) this.erreurs.push(`${champ} : obligatoire`);
      return null;
    }
    const n = Number(valeur);
    if (!Number.isInteger(n) || n <= 0) {
      this.erreurs.push(`${champ} : identifiant invalide`);
      return null;
    }
    return n;
  }
  verifier() {
    if (this.erreurs.length)
      throw erreur(400, "VALIDATION_ERROR", this.erreurs.join(" ; "));
  }
}

/** Table et champs du profil propre à chaque rôle (valeurs fixes, jamais issues de l'utilisateur). */
const PROFILS = {
  etudiant: {
    table: "etudiants",
    champs: [
      { nom: "filiere", max: 100 },
      { nom: "niveau", max: 50 },
    ],
  },
  entreprise: {
    table: "tuteurs",
    champs: [
      { nom: "entreprise_id", type: "id", requis: true },
      { nom: "fonction", max: 100 },
    ],
  },
  admin: { table: null, champs: [] },
  responsable: { table: null, champs: [] },
};

function validerProfil(v, role, brut, partiel = false) {
  const source = brut && typeof brut === "object" ? brut : {};
  const sortie = {};
  for (const c of PROFILS[role].champs) {
    const val = source[c.nom];
    if (partiel && val === undefined) continue;
    sortie[c.nom] =
      c.type === "id"
        ? v.identifiant(val, `profil.${c.nom}`, {
            requis: !partiel && c.requis,
          })
        : v.texte(val, `profil.${c.nom}`, { max: c.max });
  }
  return sortie;
}

function validerNouveauCompte(body = {}) {
  const v = new Validateur();
  const nom = v.texte(body.nom, "nom", { requis: true });
  const prenom = v.texte(body.prenom, "prenom", { requis: true });
  const email = v.email(body.email);
  const role = v.choix(body.role, "role", ROLES);
  const profil = role ? validerProfil(v, role, body.profil) : {};
  v.verifier();
  return { nom, prenom, email, role, profil };
}

function validerModification(body = {}) {
  const v = new Validateur();
  const champs = {};
  if (body.nom !== undefined)
    champs.nom = v.texte(body.nom, "nom", { requis: true });
  if (body.prenom !== undefined)
    champs.prenom = v.texte(body.prenom, "prenom", { requis: true });
  if (body.email !== undefined) champs.email = v.email(body.email);
  const role =
    body.role === undefined ? undefined : v.choix(body.role, "role", ROLES);
  v.verifier();
  if (
    !Object.keys(champs).length &&
    body.profil === undefined &&
    role === undefined
  ) {
    throw erreur(
      400,
      "VALIDATION_ERROR",
      "Aucun champ à modifier (nom, prenom, email, role, profil).",
    );
  }
  return { champs, profilBrut: body.profil, role };
}

function validerNouveauMotDePasse(body = {}) {
  const ancien = body.ancien_mot_de_passe;
  const nouveau = body.nouveau_mot_de_passe;
  const messages = [];
  if (typeof ancien !== "string" || !ancien)
    messages.push("ancien_mot_de_passe : obligatoire");
  if (typeof nouveau !== "string" || !REGEX_MDP.test(nouveau))
    messages.push(MESSAGE_MDP);
  if (messages.length)
    throw erreur(400, "VALIDATION_ERROR", messages.join(" ; "));
  return { ancien, nouveau };
}

// ---------------------------------------------------------------- comptes
function genererMotDePasse(longueur = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sans caractères ambigus
  let mdp;
  do {
    mdp = Array.from(
      { length: longueur },
      () => alphabet[crypto.randomInt(alphabet.length)],
    ).join("");
  } while (!REGEX_MDP.test(mdp));
  return mdp;
}

async function verifierEntreprise(client, entrepriseId) {
  const r = await client.query("SELECT 1 FROM entreprises WHERE id = $1", [
    entrepriseId,
  ]);
  if (!r.rowCount)
    throw erreur(
      422,
      "ENTREPRISE_NOT_FOUND",
      "L'entreprise indiquée n'existe pas.",
    );
}

async function insererProfil(client, role, utilisateurId, profil) {
  const def = PROFILS[role];
  if (!def.table) return;
  const colonnes = ["utilisateur_id", ...def.champs.map((c) => c.nom)];
  const valeurs = [
    utilisateurId,
    ...def.champs.map((c) =>
      profil[c.nom] === undefined ? null : profil[c.nom],
    ),
  ];
  await client.query(
    `INSERT INTO ${def.table} (${colonnes.join(", ")}) VALUES (${colonnes.map((_, i) => `$${i + 1}`).join(", ")})`,
    valeurs,
  );
}

/**
 * Crée utilisateur + profil dans la transaction `client`.
 * Retourne le mot de passe temporaire en clair (à communiquer UNE seule fois).
 */
async function creerCompte(client, { nom, prenom, email, role, profil }) {
  if (role === "entreprise")
    await verifierEntreprise(client, profil.entreprise_id);

  const r = await client.query("SELECT id FROM roles WHERE nom = $1", [role]);
  if (!r.rowCount)
    throw erreur(
      500,
      "ROLE_MISSING",
      `Le rôle « ${role} » n'existe pas en base.`,
    );

  const motDePasse = genererMotDePasse();
  const hash = await bcrypt.hash(motDePasse, rounds());
  const { rows } = await client.query(
    `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role_id, statut, premiere_connexion)
     VALUES ($1, $2, $3, $4, $5, 'actif', TRUE) RETURNING id`,
    [nom, prenom, email, hash, r.rows[0].id],
  );
  await insererProfil(client, role, rows[0].id, profil);
  return { id: rows[0].id, mot_de_passe_temporaire: motDePasse };
}

/** Utilisateur + rôle + profil (jamais le mot de passe). */
async function chargerUtilisateur(id, client = db) {
  const { rows } = await client.query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.statut, u.premiere_connexion,
            u.derniere_connexion, u.created_at, r.nom AS role
       FROM utilisateurs u LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [id],
  );
  if (!rows[0]) throw erreur(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
  const u = rows[0];

  let profil = {};
  if (u.role === "etudiant") {
    const p = await client.query(
      "SELECT filiere, niveau FROM etudiants WHERE utilisateur_id = $1",
      [id],
    );
    profil = p.rows[0] || {};
  } else if (u.role === "entreprise") {
    const p = await client.query(
      `SELECT t.entreprise_id, t.fonction, e.raison_sociale
         FROM tuteurs t JOIN entreprises e ON e.id = t.entreprise_id WHERE t.utilisateur_id = $1`,
      [id],
    );
    // Compte « entreprise » du socle (sans ligne tuteur) : on affiche l'entreprise qu'il possède
    const proprio = p.rows[0]
      ? null
      : await client.query(
          "SELECT id AS entreprise_id, raison_sociale FROM entreprises WHERE utilisateur_id = $1",
          [id],
        );
    profil = p.rows[0] || (proprio && proprio.rows[0]) || {};
  }
  return { ...u, profil };
}

module.exports = {
  ROLES,
  STATUTS,
  PROFILS,
  REGEX_MDP,
  rounds,
  erreur,
  gerer,
  traduireErreurPg,
  transaction,
  Validateur,
  validerProfil,
  validerNouveauCompte,
  validerModification,
  validerNouveauMotDePasse,
  genererMotDePasse,
  verifierEntreprise,
  insererProfil,
  creerCompte,
  chargerUtilisateur,
};
