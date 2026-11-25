const db = require("../config/db");

/**
 * Enregistre une notification pour un utilisateur donné.
 * @param {number} utilisateurId - L'ID de l'utilisateur destinataire
 * @param {string} message - Le contenu du message de la notification
 * @param {string} lien - Le lien de redirection associé (optionnel)
 */
const notifier = async (utilisateurId, message, lien = null) => {
  try {
    const query = `
      INSERT INTO notifications (utilisateur_id, message, lien)
      RETURNING *;
    `;
    // Note: si ton schéma possède les colonnes directement, adaptez les paramètres
    const values = [utilisateurId, message, lien];

    // Requête réelle d'insertion
    const result = await db.query(
      `INSERT INTO notifications (utilisateur_id, message, lien) VALUES ($1, $2, $3) RETURNING id, utilisateur_id, message, lien, lu, created_at`,
      values,
    );

    console.log(
      `Notification créée pour l'utilisateur ID ${utilisateurId}: "${message}"`,
    );
    return result.rows[0];
  } catch (error) {
    console.error("Erreur lors de la création de la notification :", error);
    // On ne bloque pas l'action principale si la notification échoue, mais on log l'erreur
    throw error;
  }
};

module.exports = {
  notifier,
};
