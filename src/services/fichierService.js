const fs = require('fs');

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Détecte le type réel d'un fichier à partir de ses premiers octets (« signature »).
 * Le mimetype envoyé par le client peut être falsifié, pas le contenu.
 * @returns {Promise<string|null>} le type MIME détecté, ou null si non autorisé
 */
const detecterMime = async (chemin) => {
  const fh = await fs.promises.open(chemin, 'r');
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fh.read(buf, 0, 12, 0);

    if (bytesRead >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') {
      return 'application/pdf';
    }
    if (bytesRead >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return 'image/jpeg';
    }
    if (bytesRead >= 8 && buf.subarray(0, 8).equals(SIGNATURE_PNG)) {
      return 'image/png';
    }
    if (bytesRead >= 12 &&
        buf.toString('latin1', 0, 4) === 'RIFF' &&
        buf.toString('latin1', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    return null;
  } finally {
    await fh.close();
  }
};

/** Supprime un fichier sans erreur s'il n'existe plus. */
const supprimerFichier = async (chemin) => {
  try {
    await fs.promises.unlink(chemin);
  } catch (e) {
    /* déjà absent */
  }
};

module.exports = { detecterMime, supprimerFichier };