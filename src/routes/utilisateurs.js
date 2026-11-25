const express = require("express");
const multer = require("multer");
const ctrl = require("../controllers/utilisateurController");
const { authentifier, exigerRole } = require("../middleware/auth");

const router = express.Router();

// Import CSV : fichier gardé en mémoire (1 Mo max, extension .csv). Distinct de middleware/upload.js (PDF/images).
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    /\.csv$/i.test(file.originalname || "")
      ? cb(null, true)
      : cb(
          Object.assign(new Error("Seul un fichier .csv est accepté."), {
            statusCode: 400,
            code: "INVALID_FILE_TYPE",
          }),
        ),
});

const recevoirCsv = (req, res, next) =>
  uploadCsv.single("fichier")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const trop = err.code === "LIMIT_FILE_SIZE";
      return next(
        Object.assign(
          new Error(
            trop
              ? "Fichier trop volumineux (1 Mo maximum)."
              : "Erreur de téléversement.",
          ),
          {
            statusCode: 400,
            code: trop ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
          },
        ),
      );
    }
    return next(err);
  });

// Toutes les routes de ce fichier sont réservées à l'administration
router.use(authentifier, exigerRole("admin"));

router.get("/", ctrl.lister);
router.get("/options/entreprises", ctrl.optionsEntreprises);
router.post("/import-etudiants", recevoirCsv, ctrl.importerEtudiants);
router.post("/", ctrl.creer);
router.get("/:id", ctrl.obtenir);
router.put("/:id", ctrl.modifier);
router.patch("/:id/role", ctrl.changerRole);
router.patch("/:id/desactiver", ctrl.desactiver);
router.patch("/:id/activer", ctrl.activer);

module.exports = router;
