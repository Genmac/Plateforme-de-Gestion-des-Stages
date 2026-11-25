const express = require("express");
const rateLimit = require("express-rate-limit");
const ctrl = require("../controllers/authController");
const {
  authentifier,
  authentifierPourChangementMdp,
} = require("../middleware/auth");

const router = express.Router();

// Limitation des tentatives : seules les connexions ÉCHOUÉES comptent, par adresse e-mail.
// Au-delà de LOGIN_MAX_ATTEMPTS échecs dans la fenêtre, la route répond 429.
const limiteurConnexion = rateLimit({
  windowMs: (Number(process.env.LOGIN_WINDOW_MINUTES) || 15) * 60 * 1000,
  limit: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    String((req.body && req.body.email) || "anonyme")
      .trim()
      .toLowerCase(),
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message:
          "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
      },
    }),
});

router.post("/login", limiteurConnexion, ctrl.login);
router.get("/moi", authentifier, ctrl.moi);
router.post(
  "/changer-mot-de-passe",
  authentifierPourChangementMdp,
  ctrl.changerMotDePasse,
);

module.exports = router;
