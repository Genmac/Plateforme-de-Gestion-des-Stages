const jwt = require("jsonwebtoken");
const db = require("../config/db");

const SELECT_UTILISATEUR = `SELECT u.*, r.nom AS role FROM utilisateurs u JOIN roles r ON u.role_id = r.id`;

const refuser = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });

/**
 * Fabrique les middlewares d'authentification (JWT + DEV_AUTH).
 * - Jeton absent : 401 UNAUTHORIZED ; invalide : 401 INVALID_TOKEN ; expiré : 401 TOKEN_EXPIRED
 * - Compte désactivé : 401 ACCOUNT_DISABLED (même avec un jeton encore valide)
 * - Première connexion non terminée : 403 PASSWORD_CHANGE_REQUIRED sur toutes les routes,
 *   sauf celles créées avec autoriserPremiereConnexion (changement de mot de passe)
 * - exigerPremiereConnexion : réserve la route aux comptes qui doivent encore changer leur mot de passe
 */
const creerAuthentification = ({
  autoriserPremiereConnexion = false,
  exigerPremiereConnexion = false,
} = {}) => {
  return async (req, res, next) => {
    try {
      const isDev =
        process.env.NODE_ENV === "development" &&
        process.env.DEV_AUTH === "true";
      const devUserHeader = req.headers["x-dev-user"];
      let utilisateur = null;
      let viaJwt = false;

      // 1. Mode DEV_AUTH (en-tête x-dev-user : ID ou email), jamais hors développement
      if (isDev && devUserHeader) {
        const result = await db.query(
          isNaN(devUserHeader)
            ? `${SELECT_UTILISATEUR} WHERE u.email = $1`
            : `${SELECT_UTILISATEUR} WHERE u.id = $1`,
          [devUserHeader],
        );
        utilisateur = result.rows[0] || null;
      }

      // 2. Authentification par jeton JWT ("Bearer <token>")
      if (!utilisateur) {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];
        if (!token) {
          return refuser(
            res,
            401,
            "UNAUTHORIZED",
            "Jeton d'authentification manquant.",
          );
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
          });
        } catch (err) {
          if (err.name === "TokenExpiredError") {
            return refuser(
              res,
              401,
              "TOKEN_EXPIRED",
              "Session expirée, veuillez vous reconnecter.",
            );
          }
          return refuser(res, 401, "INVALID_TOKEN", "Jeton invalide.");
        }

        // Informations actualisées depuis la base (rôle, statut, première connexion)
        const userResult = await db.query(
          `${SELECT_UTILISATEUR} WHERE u.id = $1`,
          [decoded.id],
        );
        if (userResult.rows.length === 0) {
          return refuser(
            res,
            401,
            "USER_NOT_FOUND",
            "Utilisateur associé au jeton introuvable.",
          );
        }
        utilisateur = userResult.rows[0];
        viaJwt = true;
      }

      if (utilisateur.statut && utilisateur.statut !== "actif") {
        return refuser(
          res,
          401,
          "ACCOUNT_DISABLED",
          "Ce compte est désactivé.",
        );
      }
      if (
        viaJwt &&
        utilisateur.premiere_connexion &&
        !autoriserPremiereConnexion
      ) {
        return refuser(
          res,
          403,
          "PASSWORD_CHANGE_REQUIRED",
          "Vous devez d'abord changer votre mot de passe.",
        );
      }
      if (exigerPremiereConnexion && utilisateur.premiere_connexion !== true) {
        return refuser(
          res,
          403,
          "PASSWORD_CHANGE_NOT_REQUIRED",
          "Le changement de mot de passe n'est pas requis.",
        );
      }

      // Le hash du mot de passe ne circule jamais dans req.utilisateur
      const { mot_de_passe, ...sansMotDePasse } = utilisateur;
      req.utilisateur = sansMotDePasse;
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

/** Middleware standard (même signature qu'avant pour les autres modules). */
const authentifier = creerAuthentification();

/**
 * Middleware réservé au changement de mot de passe lors de la première connexion :
 * accessible uniquement tant que premiere_connexion = true.
 */
const authentifierPourChangementMdp = creerAuthentification({
  autoriserPremiereConnexion: true,
  exigerPremiereConnexion: true,
});

/**
 * Middleware de vérification des rôles (ex: exigerRole('admin', 'responsable'))
 */
const exigerRole = (...rolesAutorises) => {
  return (req, res, next) => {
    if (!req.utilisateur || !rolesAutorises.includes(req.utilisateur.role)) {
      return refuser(
        res,
        403,
        "FORBIDDEN",
        "Accès refusé : privilèges insuffisants.",
      );
    }
    next();
  };
};

module.exports = {
  authentifier,
  authentifierPourChangementMdp,
  exigerRole,
};
