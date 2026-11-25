const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const svc = require("../services/compteService");

// Même message pour « e-mail inconnu » et « mot de passe faux » : on ne révèle pas quels e-mails existent.
const MESSAGE_IDENTIFIANTS = "E-mail ou mot de passe incorrect.";
// Comparaison factice quand l'e-mail n'existe pas : temps de réponse identique.
const HASH_FACTICE = bcrypt.hashSync("mot-de-passe-factice-1", 10);

const signerJeton = (utilisateur) =>
  jwt.sign(
    { id: utilisateur.id, role: utilisateur.role },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    },
  );

/** POST /api/auth/login */
const login = svc.gerer(async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const motDePasse =
    typeof req.body?.mot_de_passe === "string" ? req.body.mot_de_passe : "";

  const { rows } = await db.query(
    `SELECT u.id, u.mot_de_passe, u.statut, u.premiere_connexion, r.nom AS role
       FROM utilisateurs u JOIN roles r ON r.id = u.role_id WHERE u.email = $1`,
    [email],
  );
  const u = rows[0];

  const ok = await bcrypt.compare(
    motDePasse,
    u ? u.mot_de_passe : HASH_FACTICE,
  );
  if (!u || !ok)
    throw svc.erreur(401, "INVALID_CREDENTIALS", MESSAGE_IDENTIFIANTS);
  if (u.statut !== "actif") {
    throw svc.erreur(
      403,
      "ACCOUNT_DISABLED",
      "Votre compte est désactivé. Contactez l'administration.",
    );
  }

  await db.query(
    "UPDATE utilisateurs SET derniere_connexion = NOW() WHERE id = $1",
    [u.id],
  );
  const utilisateur = await svc.chargerUtilisateur(u.id);

  res.status(200).json({
    success: true,
    data: {
      token: signerJeton(u),
      premiere_connexion: u.premiere_connexion,
      utilisateur,
    },
  });
});

/** GET /api/auth/moi */
const moi = svc.gerer(async (req, res) => {
  res
    .status(200)
    .json({
      success: true,
      data: await svc.chargerUtilisateur(req.utilisateur.id),
    });
});

/** POST /api/auth/changer-mot-de-passe (obligatoire à la première connexion) */
const changerMotDePasse = svc.gerer(async (req, res) => {
  const { ancien, nouveau } = svc.validerNouveauMotDePasse(req.body);

  const { rows } = await db.query(
    "SELECT mot_de_passe FROM utilisateurs WHERE id = $1",
    [req.utilisateur.id],
  );
  if (!rows[0] || !(await bcrypt.compare(ancien, rows[0].mot_de_passe))) {
    throw svc.erreur(
      400,
      "WRONG_PASSWORD",
      "L'ancien mot de passe est incorrect.",
    );
  }
  if (ancien === nouveau) {
    throw svc.erreur(
      400,
      "SAME_PASSWORD",
      "Le nouveau mot de passe doit être différent de l'ancien.",
    );
  }

  const hash = await bcrypt.hash(nouveau, svc.rounds());
  await db.query(
    "UPDATE utilisateurs SET mot_de_passe = $1, premiere_connexion = FALSE, updated_at = NOW() WHERE id = $2",
    [hash, req.utilisateur.id],
  );
  res.status(200).json({
    success: true,
    message: "Mot de passe modifié.",
    data: { token: signerJeton(req.utilisateur) },
  });
});

module.exports = { login, moi, changerMotDePasse };
