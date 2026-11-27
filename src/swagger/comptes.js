// Documentation Swagger du module A (Comptes et accès). Fusionnée par config/swagger.js.
const reponse = (description) => ({ description });
const idParam = {
  in: "path",
  name: "id",
  required: true,
  schema: { type: "integer" },
};
const corps = (schema) => ({
  required: true,
  content: { "application/json": { schema } },
});
const erreursAdmin = {
  401: reponse(
    "UNAUTHORIZED / TOKEN_EXPIRED / INVALID_TOKEN / ACCOUNT_DISABLED",
  ),
  403: reponse("FORBIDDEN (rôle autre que admin) ou PASSWORD_CHANGE_REQUIRED"),
};
const profil = {
  type: "object",
  description:
    "etudiant : filiere, niveau. entreprise (tuteur) : entreprise_id (obligatoire), fonction. admin/responsable : aucun.",
};

module.exports = {
  paths: {
    "/auth/login": {
      post: {
        tags: ["Comptes - Auth"],
        summary: "Connexion (retourne un jeton JWT à expiration)",
        security: [],
        requestBody: corps({
          type: "object",
          required: ["email", "mot_de_passe"],
          properties: {
            email: { type: "string" },
            mot_de_passe: { type: "string" },
          },
        }),
        responses: {
          200: reponse(
            "{ success, data: { token, premiere_connexion, utilisateur } }",
          ),
          401: reponse(
            "INVALID_CREDENTIALS (message identique si e-mail ou mot de passe faux)",
          ),
          403: reponse("ACCOUNT_DISABLED"),
          429: reponse("TOO_MANY_ATTEMPTS"),
        },
      },
    },
    "/auth/moi": {
      get: {
        tags: ["Comptes - Auth"],
        summary: "Profil de l'utilisateur connecté",
        responses: { 200: reponse("Utilisateur + profil"), ...erreursAdmin },
      },
    },
    "/auth/changer-mot-de-passe": {
      post: {
        tags: ["Comptes - Auth"],
        summary:
          "Changer son mot de passe (obligatoire à la première connexion)",
        requestBody: corps({
          type: "object",
          required: ["ancien_mot_de_passe", "nouveau_mot_de_passe"],
          properties: {
            ancien_mot_de_passe: { type: "string" },
            nouveau_mot_de_passe: {
              type: "string",
              description: "8 caractères min., une lettre et un chiffre",
            },
          },
        }),
        responses: {
          200: reponse("Mot de passe modifié, nouveau jeton dans data.token"),
          400: reponse("VALIDATION_ERROR, WRONG_PASSWORD ou SAME_PASSWORD"),
          401: reponse("Jeton absent, invalide ou expiré"),
        },
      },
    },
    "/utilisateurs": {
      get: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary:
          "Lister les comptes (recherche, filtre par rôle et statut, pagination)",
        parameters: [
          {
            in: "query",
            name: "q",
            schema: { type: "string" },
            description: "nom, prénom ou e-mail",
          },
          {
            in: "query",
            name: "role",
            schema: {
              type: "string",
              enum: ["admin", "responsable", "etudiant", "entreprise"],
            },
          },
          {
            in: "query",
            name: "statut",
            schema: { type: "string", enum: ["actif", "desactive"] },
          },
          {
            in: "query",
            name: "page",
            schema: { type: "integer", default: 1 },
          },
          {
            in: "query",
            name: "limite",
            schema: { type: "integer", default: 20, maximum: 100 },
          },
        ],
        responses: {
          200: reponse(
            "{ success, data: [...], meta: { total, page, limite } }",
          ),
          ...erreursAdmin,
        },
      },
      post: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary:
          "Créer un compte (mot de passe temporaire généré, affiché une seule fois)",
        requestBody: corps({
          type: "object",
          required: ["nom", "prenom", "email", "role"],
          properties: {
            nom: { type: "string" },
            prenom: { type: "string" },
            email: { type: "string" },
            role: {
              type: "string",
              enum: ["admin", "responsable", "etudiant", "entreprise"],
            },
            profil,
          },
        }),
        responses: {
          201: reponse(
            "{ success, data: { utilisateur, mot_de_passe_temporaire } }",
          ),
          400: reponse("VALIDATION_ERROR"),
          409: reponse("EMAIL_ALREADY_EXISTS"),
          422: reponse("ENTREPRISE_NOT_FOUND"),
          ...erreursAdmin,
        },
      },
    },
    "/utilisateurs/options/entreprises": {
      get: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary: "Entreprises disponibles pour rattacher un tuteur",
        responses: {
          200: reponse("[{ id, raison_sociale }]"),
          ...erreursAdmin,
        },
      },
    },
    "/utilisateurs/import-etudiants": {
      post: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary:
          "Import CSV d'étudiants (les lignes en erreur sont listées sans bloquer les autres)",
        description:
          "En-tête : nom,prenom,email,filiere,niveau (séparateur , ou ;). 500 lignes et 1 Mo maximum.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { fichier: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          200: reponse(
            "{ success, data: { total_lignes, crees, comptes[], erreurs[{ ligne, email, motif }] } }",
          ),
          400: reponse("CSV_INVALID, CSV_MISSING_COLUMNS, FILE_MISSING, ..."),
          ...erreursAdmin,
        },
      },
    },
    "/utilisateurs/{id}": {
      get: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary: "Détail d'un compte et de son profil",
        parameters: [idParam],
        responses: {
          200: reponse("Utilisateur + profil"),
          404: reponse("USER_NOT_FOUND"),
          ...erreursAdmin,
        },
      },
      put: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary:
          "Modifier un compte : nom, prenom, email, role, profil (une seule transaction)",
        description:
          "Champs tous optionnels. Si `role` diffère du rôle actuel, `profil` doit être le profil COMPLET du nouveau rôle " +
          "(l'ancien profil est supprimé). Sinon `profil` ne contient que les champs à modifier.",
        parameters: [idParam],
        requestBody: corps({
          type: "object",
          properties: {
            nom: { type: "string" },
            prenom: { type: "string" },
            email: { type: "string" },
            role: {
              type: "string",
              enum: ["admin", "responsable", "etudiant", "entreprise"],
            },
            profil,
          },
        }),
        responses: {
          200: reponse("Utilisateur mis à jour"),
          400: reponse(
            "VALIDATION_ERROR, SELF_ACTION (changer son propre rôle)",
          ),
          409: reponse(
            "EMAIL_ALREADY_EXISTS, REFERENCE_CONFLICT, PROFILE_MISSING",
          ),
          422: reponse("ENTREPRISE_NOT_FOUND"),
          ...erreursAdmin,
        },
      },
    },
    "/utilisateurs/{id}/role": {
      patch: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary: "Attribuer un autre rôle (fournir le profil du nouveau rôle)",
        parameters: [idParam],
        requestBody: corps({
          type: "object",
          required: ["role"],
          properties: {
            role: {
              type: "string",
              enum: ["admin", "responsable", "etudiant", "entreprise"],
            },
            profil,
          },
        }),
        responses: {
          200: reponse("Utilisateur avec son nouveau rôle"),
          409: reponse(
            "REFERENCE_CONFLICT (profil déjà référencé, ex. étudiant avec une candidature)",
          ),
          ...erreursAdmin,
        },
      },
    },
    "/utilisateurs/{id}/desactiver": {
      patch: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary:
          "Désactiver un compte (connexion impossible, jetons existants refusés)",
        parameters: [idParam],
        responses: {
          200: reponse("Utilisateur désactivé"),
          400: reponse("SELF_ACTION"),
          ...erreursAdmin,
        },
      },
    },
    "/utilisateurs/{id}/activer": {
      patch: {
        tags: ["Comptes - Utilisateurs (admin)"],
        summary: "Réactiver un compte",
        parameters: [idParam],
        responses: { 200: reponse("Utilisateur réactivé"), ...erreursAdmin },
      },
    },
  },
};
