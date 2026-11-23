/**
 * Middleware de gestion centralisée des erreurs.
 * Formate uniformément toutes les erreurs renvoyées par l'API.
 */
const gestionnaireErreurs = (err, req, res, next) => {
  console.error('Erreur serveur :', err.stack || err);

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Une erreur interne est survenue sur le serveur.'
    }
  });
};

module.exports = gestionnaireErreurs;