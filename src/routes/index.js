const fs = require("fs");
const path = require("path");
const express = require("express");

const router = express.Router();

// Lecture dynamique du dossier routes/
const currentDir = __dirname;
const files = fs.readdirSync(currentDir);

files.forEach((file) => {
  // Ignore le fichier index.js et les fichiers non-JS
  if (file === "index.js" || !file.endsWith(".js")) {
    return;
  }

  const routeName = path.basename(file, ".js");
  const routePath = path.join(currentDir, file);

  try {
    const routeModule = require(routePath);
    // Monte chaque fichier sur son nom (ex: notifications.js -> /notifications)
    router.use(`/${routeName}`, routeModule);
    console.log(
      `Route-Message : Route chargée automatiquement : /api/${routeName}`,
    );
  } catch (error) {
    console.error(
      `Route-Message(erreur) : Erreur lors du chargement de la route ${file}:`,
      error,
    );
  }
});

module.exports = router;
