const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware d'authentification (JWT + DEV_AUTH)
 */
const authentifier = async (req, res, next) => {
  try {
    const isDev = process.env.NODE_ENV === 'development' && process.env.DEV_AUTH === 'true';
    const devUserHeader = req.headers['x-dev-user'];

    // 1. Mode DEV_AUTH actif en développement (si l'en-tête x-dev-user est fourni)
    if (isDev && devUserHeader) {
      // devUserHeader peut être un ID (ex: '1') ou un email (ex: 'admin@gestion-stages.sn')
      const queryText = isNaN(devUserHeader)
        ? `SELECT u.*, r.nom as role FROM utilisateurs u JOIN roles r ON u.role_id = r.id WHERE u.email = $1`
        : `SELECT u.*, r.nom as role FROM utilisateurs u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`;

      const result = await db.query(queryText, [devUserHeader]);
      
      if (result.rows.length > 0) {
        req.utilisateur = result.rows[0];
        return next();
      }
    }

    // 2. Authentification classique par Jeton JWT
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format attendu : "Bearer <token>"

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Jeton d\'authentification manquant.' }
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Jeton invalide ou expiré.' }
        });
      }

      // Récupération des informations actualisées de l'utilisateur en base
      const userResult = await db.query(
        `SELECT u.*, r.nom as role FROM utilisateurs u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
        [decoded.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Utilisateur associé au jeton introuvable.' }
        });
      }

      req.utilisateur = userResult.rows[0];
      next();
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware de vérification des rôles (ex: exigerRole('admin', 'responsable'))
 */
const exigerRole = (...rolesAutorises) => {
  return (req, res, next) => {
    if (!req.utilisateur || !rolesAutorises.includes(req.utilisateur.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Accès refusé : privilèges insuffisants.' }
      });
    }
    next();
  };
};

module.exports = {
  authentifier,
  exigerRole
};