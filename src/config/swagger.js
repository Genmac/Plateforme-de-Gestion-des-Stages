// ---------------------------------------------------------------------------
// Fabriques de morceaux réutilisés (évitent de répéter les mêmes blocs)
// ---------------------------------------------------------------------------
const parametreId = (nom = 'id', description = 'Identifiant numérique') => ({
  name: nom, in: 'path', required: true, description, schema: { type: 'integer' }
});

const reponseErreur = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erreur' } } }
});

const reponseOk = (description, schema) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { success: { type: 'boolean', example: true }, data: schema }
      }
    }
  }
});

const reponsesCommunes = {
  401: reponseErreur('Authentification manquante'),
  403: reponseErreur('Rôle insuffisant')
};

const corpsJson = (schema, requis = true) => ({
  required: requis,
  content: { 'application/json': { schema } }
});

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'API Gestion des Stages',
    version: '1.0.0',
    description: 'Documentation API du socle et des modules (Comptes, Entreprises & Candidatures, Conventions).'
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Serveur de développement local'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      devUserHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-dev-user',
        description: 'ID ou email utilisateur en mode DEV_AUTH=true'
      }
    },
    schemas: {
      Erreur: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' }
            }
          }
        }
      },
      Entreprise: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          raison_sociale: { type: 'string' },
          secteur_activite: { type: 'string', nullable: true },
          adresse: { type: 'string', nullable: true },
          contact_nom: { type: 'string', nullable: true },
          contact_email: { type: 'string', nullable: true },
          contact_telephone: { type: 'string', nullable: true },
          site_web: { type: 'string', nullable: true },
          statut: { type: 'string', enum: ['a_valider', 'validee', 'rejetee'] },
          proposee_par: { type: 'integer', nullable: true },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      EntrepriseEntree: {
        type: 'object',
        required: ['raison_sociale'],
        properties: {
          raison_sociale: { type: 'string' },
          secteur_activite: { type: 'string' },
          adresse: { type: 'string' },
          contact_nom: { type: 'string' },
          contact_email: { type: 'string' },
          contact_telephone: { type: 'string' },
          site_web: { type: 'string' },
          confirmer_doublon: {
            type: 'boolean',
            description: 'true pour créer malgré l\'alerte de doublon (409)'
          }
        }
      },
      Candidature: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          etudiant_id: { type: 'integer' },
          entreprise_id: { type: 'integer' },
          entreprise: { type: 'string' },
          poste: { type: 'string' },
          contact: { type: 'string', nullable: true },
          date_candidature: { type: 'string', format: 'date' },
          statut: {
            type: 'string',
            enum: ['envoyee', 'en_attente', 'entretien', 'acceptee', 'refusee', 'retiree']
          },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      CandidatureEntree: {
        type: 'object',
        required: ['entreprise_id', 'poste'],
        properties: {
          entreprise_id: { type: 'integer', description: 'Doit être une entreprise validée' },
          poste: { type: 'string' },
          contact: { type: 'string' },
          date_candidature: { type: 'string', format: 'date', description: 'AAAA-MM-JJ (défaut : aujourd\'hui)' }
        }
      },
      HistoriqueStatut: {
        type: 'object',
        properties: {
          ancien_statut: { type: 'string', nullable: true },
          nouveau_statut: { type: 'string' },
          change_par: { type: 'integer', nullable: true },
          change_le: { type: 'string', format: 'date-time' }
        }
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          type: { type: 'string', enum: ['cv', 'lettre', 'preuve_acceptation'] },
          nom_original: { type: 'string' },
          mime_type: { type: 'string' },
          taille: { type: 'integer', description: 'En octets' },
          depose_le: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }, { devUserHeader: [] }],
  paths: {
    // ----------------------------------------------------------------- Socle
    '/notifications': {
      get: {
        summary: 'Lister les notifications de l’utilisateur connecté',
        tags: ['Socle - Notifications'],
        responses: {
          200: { description: 'Liste des notifications récupérée avec succès' }
        }
      }
    },

    // ----------------------------------------------------------- Entreprises
    '/entreprises': {
      get: {
        summary: 'Lister et rechercher les entreprises',
        description: 'Admin / responsable : toutes les entreprises (filtre `statut` possible). ' +
          'Étudiant : entreprises validées et ses propres propositions.',
        tags: ['Entreprises'],
        parameters: [
          { name: 'q', in: 'query', description: 'Recherche par nom (insensible à la casse)', schema: { type: 'string' } },
          { name: 'statut', in: 'query', description: 'Filtre (admin / responsable uniquement)',
            schema: { type: 'string', enum: ['a_valider', 'validee', 'rejetee'] } }
        ],
        responses: {
          200: reponseOk('Liste des entreprises', { type: 'array', items: { $ref: '#/components/schemas/Entreprise' } }),
          ...reponsesCommunes
        }
      },
      post: {
        summary: 'Créer ou proposer une entreprise',
        description: 'Admin / responsable : créée directement « validée ». Étudiant : créée « à valider » ' +
          'et l\'administration est notifiée. Un nom déjà existant renvoie 409 `DUPLICATE_WARNING` ' +
          'avec la liste des doublons ; renvoyer avec `confirmer_doublon: true` pour forcer.',
        tags: ['Entreprises'],
        requestBody: corpsJson({ $ref: '#/components/schemas/EntrepriseEntree' }),
        responses: {
          201: reponseOk('Entreprise créée', { $ref: '#/components/schemas/Entreprise' }),
          400: reponseErreur('Nom manquant (VALIDATION_ERROR)'),
          409: reponseErreur('Alerte de doublon (DUPLICATE_WARNING, champ error.doublons)'),
          ...reponsesCommunes
        }
      }
    },
    '/entreprises/{id}': {
      get: {
        summary: 'Détail d\'une entreprise',
        tags: ['Entreprises'],
        parameters: [parametreId()],
        responses: {
          200: reponseOk('Entreprise', { $ref: '#/components/schemas/Entreprise' }),
          404: reponseErreur('Introuvable ou non visible pour ce rôle'),
          ...reponsesCommunes
        }
      },
      put: {
        summary: 'Modifier une entreprise (admin / responsable)',
        description: 'Les champs omis restent inchangés.',
        tags: ['Entreprises'],
        parameters: [parametreId()],
        requestBody: corpsJson({ $ref: '#/components/schemas/EntrepriseEntree' }),
        responses: {
          200: reponseOk('Entreprise modifiée', { $ref: '#/components/schemas/Entreprise' }),
          404: reponseErreur('Introuvable'),
          ...reponsesCommunes
        }
      }
    },
    '/entreprises/{id}/valider': {
      patch: {
        summary: 'Valider une entreprise proposée (admin / responsable)',
        description: 'Seules les entreprises « à valider » sont traitables. Le proposant est notifié.',
        tags: ['Entreprises'],
        parameters: [parametreId()],
        responses: {
          200: reponseOk('Entreprise validée', { $ref: '#/components/schemas/Entreprise' }),
          409: reponseErreur('Introuvable ou déjà traitée (NOT_PENDING)'),
          ...reponsesCommunes
        }
      }
    },
    '/entreprises/{id}/rejeter': {
      patch: {
        summary: 'Rejeter une entreprise proposée (admin / responsable)',
        tags: ['Entreprises'],
        parameters: [parametreId()],
        responses: {
          200: reponseOk('Entreprise rejetée', { $ref: '#/components/schemas/Entreprise' }),
          409: reponseErreur('Introuvable ou déjà traitée (NOT_PENDING)'),
          ...reponsesCommunes
        }
      }
    },

    // ----------------------------------------------------------- Candidatures
    '/candidatures': {
      get: {
        summary: 'Lister les candidatures',
        description: 'Étudiant : uniquement les siennes. Admin / responsable : toutes (lecture seule).',
        tags: ['Candidatures'],
        responses: {
          200: reponseOk('Liste des candidatures', { type: 'array', items: { $ref: '#/components/schemas/Candidature' } }),
          ...reponsesCommunes
        }
      },
      post: {
        summary: 'Enregistrer une candidature (étudiant)',
        description: 'Statut initial « envoyee », première ligne d\'historique créée dans la même transaction.',
        tags: ['Candidatures'],
        requestBody: corpsJson({ $ref: '#/components/schemas/CandidatureEntree' }),
        responses: {
          201: reponseOk('Candidature créée', { $ref: '#/components/schemas/Candidature' }),
          400: reponseErreur('Champs invalides (VALIDATION_ERROR)'),
          404: reponseErreur('Entreprise introuvable'),
          422: reponseErreur('Entreprise non validée (ENTREPRISE_NOT_VALIDATED)'),
          ...reponsesCommunes
        }
      }
    },
    '/candidatures/{id}': {
      get: {
        summary: 'Détail d\'une candidature avec historique et documents',
        description: 'Un étudiant ne peut lire que ses propres candidatures (404 sinon).',
        tags: ['Candidatures'],
        parameters: [parametreId()],
        responses: {
          200: reponseOk('Candidature détaillée', {
            allOf: [
              { $ref: '#/components/schemas/Candidature' },
              {
                type: 'object',
                properties: {
                  historique: { type: 'array', items: { $ref: '#/components/schemas/HistoriqueStatut' } },
                  documents: { type: 'array', items: { $ref: '#/components/schemas/Document' } }
                }
              }
            ]
          }),
          404: reponseErreur('Introuvable ou appartenant à un autre étudiant'),
          ...reponsesCommunes
        }
      }
    },
    '/candidatures/{id}/statut': {
      patch: {
        summary: 'Changer le statut d\'une candidature (étudiant propriétaire)',
        description: 'Statuts : envoyee, en_attente, entretien, acceptee, refusee, retiree. ' +
          '« refusee » et « retiree » sont définitifs. Passer à « acceptee » exige un document ' +
          '`preuve_acceptation` (422 `PROOF_REQUIRED` sinon). Chaque changement est daté dans l\'historique.',
        tags: ['Candidatures'],
        parameters: [parametreId()],
        requestBody: corpsJson({
          type: 'object',
          required: ['statut'],
          properties: {
            statut: { type: 'string', enum: ['envoyee', 'en_attente', 'entretien', 'acceptee', 'refusee', 'retiree'] }
          }
        }),
        responses: {
          200: reponseOk('Statut mis à jour', { $ref: '#/components/schemas/Candidature' }),
          400: reponseErreur('Statut invalide (VALIDATION_ERROR)'),
          404: reponseErreur('Introuvable ou appartenant à un autre étudiant'),
          409: reponseErreur('Même statut (SAME_STATUS) ou candidature clôturée (FINAL_STATUS)'),
          422: reponseErreur('Preuve d\'acceptation manquante (PROOF_REQUIRED)'),
          ...reponsesCommunes
        }
      }
    },
    '/candidatures/{id}/documents': {
      post: {
        summary: 'Déposer un document (étudiant propriétaire)',
        description: 'PDF, JPEG, PNG ou WEBP, 10 Mo maximum. Le contenu réel du fichier est vérifié ' +
          '(pas seulement le type déclaré). Un nouveau dépôt du même type remplace le précédent.',
        tags: ['Candidatures'],
        parameters: [parametreId()],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['type', 'fichier'],
                properties: {
                  type: { type: 'string', enum: ['cv', 'lettre', 'preuve_acceptation'] },
                  fichier: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: {
          201: reponseOk('Document enregistré', { $ref: '#/components/schemas/Document' }),
          400: reponseErreur('Type de document invalide, fichier absent, type non autorisé (INVALID_FILE_TYPE) ou contenu falsifié (INVALID_FILE_CONTENT)'),
          404: reponseErreur('Candidature introuvable ou appartenant à un autre étudiant'),
          409: reponseErreur('Candidature clôturée (FINAL_STATUS)'),
          413: reponseErreur('Fichier de plus de 10 Mo (FILE_TOO_LARGE)'),
          ...reponsesCommunes
        }
      }
    },
    '/candidatures/{id}/documents/{docId}': {
      get: {
        summary: 'Télécharger un document',
        description: 'Propriétaire, admin ou responsable. Les fichiers ne sont pas accessibles autrement.',
        tags: ['Candidatures'],
        parameters: [parametreId(), parametreId('docId', 'Identifiant du document')],
        responses: {
          200: { description: 'Contenu du fichier', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
          404: reponseErreur('Document introuvable ou non autorisé'),
          ...reponsesCommunes
        }
      }
    }
  }
};

module.exports = swaggerSpec;