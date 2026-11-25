const fs = require("fs");
const path = require("path");

const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "API Gestion des Stages",
    version: "1.0.0",
    description:
      "Documentation API du socle et des modules (Comptes, Candidatures, Conventions).",
  },
  servers: [
    {
      url: "http://localhost:3000/api",
      description: "Serveur de développement local",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      devUserHeader: {
        type: "apiKey",
        in: "header",
        name: "x-dev-user",
        description: "ID ou email utilisateur en mode DEV_AUTH=true",
      },
    },
    schemas: {},
  },
  security: [{ bearerAuth: [] }, { devUserHeader: [] }],
  paths: {
    "/notifications": {
      get: {
        summary: "Lister les notifications de l’utilisateur connecté",
        tags: ["Socle - Notifications"],
        responses: {
          200: { description: "Liste des notifications récupérée avec succès" },
        },
      },
    },
  },
};

// Fusion automatique des fichiers src/swagger/*.js (un par module : évite les conflits Git).
// Chaque fichier exporte { paths: {...}, schemas: {...} }.
const dossierModules = path.join(__dirname, "../swagger");
if (fs.existsSync(dossierModules)) {
  fs.readdirSync(dossierModules)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .forEach((f) => {
      const doc = require(path.join(dossierModules, f));
      Object.assign(swaggerSpec.paths, doc.paths || {});
      Object.assign(swaggerSpec.components.schemas, doc.schemas || {});
    });
}

module.exports = swaggerSpec;
