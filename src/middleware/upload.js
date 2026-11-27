const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TYPES_AUTORISES = {
  "application/pdf": {
    extensions: [".pdf"],
    extensionStockage: ".pdf",
    verifierSignature: (buffer) =>
      buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  "image/jpeg": {
    extensions: [".jpg", ".jpeg"],
    extensionStockage: ".jpg",
    verifierSignature: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  "image/png": {
    extensions: [".png"],
    extensionStockage: ".png",
    verifierSignature: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  "image/webp": {
    extensions: [".webp"],
    extensionStockage: ".webp",
    verifierSignature: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP",
  },
};

const creerErreurUpload = (
  message,
  code = "INVALID_FILE",
  statusCode = 400,
) => {
  const erreur = new Error(message);
  erreur.statusCode = statusCode;
  erreur.code = code;
  return erreur;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    try {
      const type = TYPES_AUTORISES[file.mimetype];
      if (!type) {
        return cb(
          creerErreurUpload(
            "Type de fichier non autorisé.",
            "INVALID_FILE_TYPE",
          ),
        );
      }

      const nomFichier = `${Date.now()}-${crypto.randomUUID()}${type.extensionStockage}`;
      cb(null, nomFichier);
    } catch (error) {
      cb(error);
    }
  },
});

const fileFilter = (req, file, cb) => {
  const type = TYPES_AUTORISES[file.mimetype];
  if (!type) {
    return cb(
      creerErreurUpload(
        "Type de fichier non autorisé. Seuls les fichiers PDF et les images (JPEG, PNG, WEBP) sont acceptés.",
        "INVALID_FILE_TYPE",
      ),
    );
  }

  const extensionOriginale = path
    .extname(file.originalname || "")
    .toLowerCase();
  if (!extensionOriginale || !type.extensions.includes(extensionOriginale)) {
    return cb(
      creerErreurUpload(
        "Extension de fichier invalide ou incohérente avec le type autorisé.",
        "INVALID_FILE_EXTENSION",
      ),
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

const lireSignatureFichier = async (cheminFichier) => {
  const handle = await fs.promises.open(cheminFichier, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, 12, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

const collecterFichiers = (req) => {
  const fichiers = [];
  if (req.file) fichiers.push(req.file);
  if (Array.isArray(req.files)) {
    fichiers.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    Object.values(req.files).forEach((valeur) => {
      if (Array.isArray(valeur)) fichiers.push(...valeur);
      else if (valeur) fichiers.push(valeur);
    });
  }
  return fichiers;
};

const supprimerFichier = async (cheminFichier) => {
  if (!cheminFichier) return;
  try {
    await fs.promises.unlink(cheminFichier);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

const validerContenuFichier = async (req, res, next) => {
  const fichiers = collecterFichiers(req);
  if (fichiers.length === 0) return next();

  try {
    for (const fichier of fichiers) {
      const type = TYPES_AUTORISES[fichier.mimetype];
      if (!type || !fichier.path) {
        await Promise.all(fichiers.map((f) => supprimerFichier(f.path)));
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Type de fichier non autorisé.",
          },
        });
      }

      const signature = await lireSignatureFichier(fichier.path);
      if (!type.verifierSignature(signature)) {
        await Promise.all(fichiers.map((f) => supprimerFichier(f.path)));
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_FILE_CONTENT",
            message: "Le contenu du fichier ne correspond pas au type déclaré.",
          },
        });
      }
    }

    return next();
  } catch (error) {
    await Promise.all(
      fichiers.map((f) => supprimerFichier(f.path).catch(() => {})),
    );
    return next(error);
  }
};

const gererErreurUpload = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "Le fichier dépasse la taille maximale autorisée (10 Mo).",
        },
      });
    }
    if (
      err.code === "LIMIT_FILE_COUNT" ||
      err.code === "LIMIT_UNEXPECTED_FILE"
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FILE_COUNT",
          message: "Nombre ou champ de fichier invalide.",
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        code: "UPLOAD_ERROR",
        message: "Erreur lors du téléversement du fichier.",
      },
    });
  }

  if (err && err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || "UPLOAD_ERROR",
        message: err.message || "Erreur lors du téléversement du fichier.",
      },
    });
  }

  return next(err);
};

module.exports = upload;
module.exports.upload = upload;
module.exports.validerContenuFichier = validerContenuFichier;
module.exports.gererErreurUpload = gererErreurUpload;
