// ---------------------------------------------------------------------------
// Fabriques de morceaux réutilisés
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

const STATUTS_CANDIDATURE = ['envoyee', 'en_attente', 'entretien', 'acceptee', 'refusee', 'retiree'];
const STATUTS_CONVENTION = ['brouillon', 'soumise', 'validee', 'refusee', 'a_corriger'];

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'API Gestion des Stages',
    version: '1.0.0',
    description: 'Documentation API du socle et des modules (Comptes, Entreprises & Candidatures, Stages & Conventions).'
  },
  servers: [
    { url: 'http://localhost:3000/api', description: 'Serveur de développement local' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
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

      // ------------------------------------------------ Module B
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
          confirmer_doublon: { type: 'boolean', description: 'true pour créer malgré l\'alerte de doublon (409)' }
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
          statut: { type: 'string', enum: STATUTS_CANDIDATURE },
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
      },

      // ------------------------------------------------ Module C
      Convention: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          stage_id: { type: 'integer' },
          statut: { type: 'string', enum: STATUTS_CONVENTION },
          motif: { type: 'string', nullable: true, description: 'Renseigné en cas de refus ou de correction' },
          soumise_le: { type: 'string', format: 'date-time', nullable: true },
          etudiant_id: { type: 'integer' },
          etudiant: { type: 'string' },
          entreprise_id: { type: 'integer', nullable: true },
          entreprise: { type: 'string', nullable: true },
          tuteur_id: { type: 'integer', nullable: true },
          tuteur: { type: 'string', nullable: true },
          encadrant_id: { type: 'integer', nullable: true },
          encadrant: { type: 'string', nullable: true },
          candidature_id: { type: 'integer', nullable: true, description: 'Lien par identifiant, sans clé étrangère' },
          origine: { type: 'string', enum: ['initiative_etudiant', 'envoi_departement', 'demande_entreprise'] },
          sujet: { type: 'string', nullable: true },
          missions: { type: 'string', nullable: true },
          gratification: { type: 'number', nullable: true },
          date_debut: { type: 'string', format: 'date', nullable: true },
          date_fin: { type: 'string', format: 'date', nullable: true },
          statut_stage: { type: 'string', enum: ['actif', 'termine', 'annule'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      ConventionEntree: {
        type: 'object',
        description: 'Tous les champs sont facultatifs pour un brouillon ; les champs obligatoires sont vérifiés à la soumission.',
        properties: {
          entreprise_id: { type: 'integer' },
          tuteur_id: { type: 'integer', description: 'Utilisateur de rôle « entreprise »' },
          candidature_id: { type: 'integer' },
          origine: { type: 'string', enum: ['initiative_etudiant', 'envoi_departement', 'demande_entreprise'] },
          sujet: { type: 'string' },
          missions: { type: 'string' },
          gratification: { type: 'number', minimum: 0 },
          date_debut: { type: 'string', format: 'date' },
          date_fin: { type: 'string', format: 'date', description: 'Postérieure à date_debut' }
        }
      },
      HistoriqueConvention: {
        type: 'object',
        properties: {
          ancien_statut: { type: 'string', nullable: true },
          nouveau_statut: { type: 'string' },
          commentaire: { type: 'string', nullable: true },
          change_par: { type: 'integer', nullable: true },
          auteur: { type: 'string', nullable: true },
          change_le: { type: 'string', format: 'date-time' }
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
        responses: { 200: { description: 'Liste des notifications récupérée avec succès' } }
      }
    },

    // ----------------------------------------------------------- Entreprises
    '/entreprises': {
      get: {
        summary: 'Lister et rechercher les entreprises',
        description: 'Admin / responsable : toutes (filtre `statut` possible). Étudiant : validées et ses propositions.',
        tags: ['Entreprises'],
        parameters: [
          { name: 'q', in: 'query', description: 'Recherche par nom', schema: { type: 'string' } },
          { name: 'statut', in: 'query', description: 'Filtre (admin / responsable)',
            schema: { type: 'string', enum: ['a_valider', 'validee', 'rejetee'] } }
        ],
        responses: {
          200: reponseOk('Liste des entreprises', { type: 'array', items: { $ref: '#/components/schemas/Entreprise' } }),
          ...reponsesCommunes
        }
      },
      post: {
        summary: 'Créer ou proposer une entreprise',
        description: 'Admin / responsable : créée « validée ». Étudiant : « à valider » et l\'administration est notifiée. ' +
          'Un nom existant renvoie 409 `DUPLICATE_WARNING` ; renvoyer avec `confirmer_doublon: true` pour forcer.',
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
        description: 'Étudiant : les siennes. Admin / responsable : toutes (lecture seule).',
        tags: ['Candidatures'],
        responses: {
          200: reponseOk('Liste des candidatures', { type: 'array', items: { $ref: '#/components/schemas/Candidature' } }),
          ...reponsesCommunes
        }
      },
      post: {
        summary: 'Enregistrer une candidature (étudiant)',
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
        description: '« refusee » et « retiree » sont définitifs. « acceptee » exige une `preuve_acceptation` (422 `PROOF_REQUIRED`).',
        tags: ['Candidatures'],
        parameters: [parametreId()],
        requestBody: corpsJson({
          type: 'object',
          required: ['statut'],
          properties: { statut: { type: 'string', enum: STATUTS_CANDIDATURE } }
        }),
        responses: {
          200: reponseOk('Statut mis à jour', { $ref: '#/components/schemas/Candidature' }),
          400: reponseErreur('Statut invalide (VALIDATION_ERROR)'),
          404: reponseErreur('Introuvable ou appartenant à un autre étudiant'),
          409: reponseErreur('Même statut (SAME_STATUS) ou clôturée (FINAL_STATUS)'),
          422: reponseErreur('Preuve d\'acceptation manquante (PROOF_REQUIRED)'),
          ...reponsesCommunes
        }
      }
    },
    '/candidatures/{id}/documents': {
      post: {
        summary: 'Déposer un document (étudiant propriétaire)',
        description: 'PDF, JPEG, PNG ou WEBP, 10 Mo maximum, contenu réel vérifié. Un nouveau dépôt du même type remplace le précédent.',
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
          400: reponseErreur('Type invalide, fichier absent, INVALID_FILE_TYPE ou INVALID_FILE_CONTENT'),
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
        tags: ['Candidatures'],
        parameters: [parametreId(), parametreId('docId', 'Identifiant du document')],
        responses: {
          200: { description: 'Contenu du fichier', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
          404: reponseErreur('Document introuvable ou non autorisé'),
          ...reponsesCommunes
        }
      }
    },

    // ----------------------------------------------------------- Conventions
    '/conventions': {
      get: {
        summary: 'Lister les conventions',
        description: 'Étudiant : les siennes. Tuteur (`entreprise`) : celles où il est désigné. ' +
          'Responsable : celles de ses stages. Admin : toutes. `a_traiter=true` ne garde que les conventions soumises.',
        tags: ['Conventions'],
        parameters: [
          { name: 'a_traiter', in: 'query', description: 'true : conventions en attente de décision', schema: { type: 'boolean' } },
          { name: 'statut', in: 'query', schema: { type: 'string', enum: STATUTS_CONVENTION } }
        ],
        responses: {
          200: reponseOk('Liste des conventions', { type: 'array', items: { $ref: '#/components/schemas/Convention' } }),
          ...reponsesCommunes
        }
      },
      post: {
        summary: 'Créer un stage et sa convention en brouillon (étudiant)',
        description: 'Les champs obligatoires ne sont pas exigés pour un brouillon. Un seul stage actif par étudiant.',
        tags: ['Conventions'],
        requestBody: corpsJson({ $ref: '#/components/schemas/ConventionEntree' }, false),
        responses: {
          201: reponseOk('Brouillon créé', { $ref: '#/components/schemas/Convention' }),
          400: reponseErreur('Format invalide ou dates incohérentes (VALIDATION_ERROR, INVALID_DATES)'),
          409: reponseErreur('Stage actif déjà existant (ACTIVE_STAGE_EXISTS)'),
          422: reponseErreur('Entreprise introuvable ou tuteur invalide (ENTREPRISE_NOT_FOUND, INVALID_TUTOR)'),
          ...reponsesCommunes
        }
      }
    },
    '/conventions/options': {
      get: {
        summary: 'Données du formulaire de convention',
        description: 'Entreprises disposant d\'un compte tuteur ; liste des encadrants pour admin / responsable.',
        tags: ['Conventions'],
        responses: {
          200: reponseOk('Options', {
            type: 'object',
            properties: {
              entreprises: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    raison_sociale: { type: 'string' },
                    tuteur_id: { type: 'integer' }
                  }
                }
              },
              encadrants: {
                type: 'array',
                items: { type: 'object', properties: { id: { type: 'integer' }, nom: { type: 'string' } } }
              }
            }
          }),
          ...reponsesCommunes
        }
      }
    },
    '/conventions/{id}': {
      get: {
        summary: 'Fiche d\'une convention avec historique',
        description: '404 si la convention n\'est pas visible pour le rôle (existence non révélée).',
        tags: ['Conventions'],
        parameters: [parametreId()],
        responses: {
          200: reponseOk('Convention détaillée', {
            allOf: [
              { $ref: '#/components/schemas/Convention' },
              {
                type: 'object',
                properties: {
                  historique: { type: 'array', items: { $ref: '#/components/schemas/HistoriqueConvention' } }
                }
              }
            ]
          }),
          404: reponseErreur('Introuvable ou non visible'),
          ...reponsesCommunes
        }
      },
      put: {
        summary: 'Modifier ou reprendre un brouillon (étudiant propriétaire)',
        description: 'Possible pour les statuts « brouillon » et « a_corriger » uniquement.',
        tags: ['Conventions'],
        parameters: [parametreId()],
        requestBody: corpsJson({ $ref: '#/components/schemas/ConventionEntree' }),
        responses: {
          200: reponseOk('Convention modifiée', { $ref: '#/components/schemas/Convention' }),
          400: reponseErreur('Format invalide ou dates incohérentes'),
          404: reponseErreur('Introuvable ou appartenant à un autre étudiant'),
          409: reponseErreur('Convention verrouillée (LOCKED)'),
          422: reponseErreur('Entreprise introuvable ou tuteur invalide'),
          ...reponsesCommunes
        }
      }
    },
    '/conventions/{id}/soumettre': {
      post: {
        summary: 'Soumettre la convention (étudiant propriétaire)',
        description: 'Vérifie les champs obligatoires. Notifie le tuteur et l\'encadrant (à défaut, les administrateurs).',
        tags: ['Conventions'],
        parameters: [parametreId()],
        responses: {
          200: reponseOk('Convention soumise', { $ref: '#/components/schemas/Convention' }),
          404: reponseErreur('Introuvable ou appartenant à un autre étudiant'),
          409: reponseErreur('Convention verrouillée (LOCKED)'),
          422: reponseErreur('Champs obligatoires manquants (INCOMPLETE, champ error.manquants)'),
          ...reponsesCommunes
        }
      }
    },
    '/conventions/{id}/decision': {
      patch: {
        summary: 'Valider, refuser ou demander une correction (encadrant du stage ou admin)',
        description: 'Uniquement sur une convention « soumise ». Le motif est obligatoire pour `refusee` et `a_corriger`. L\'étudiant est notifié.',
        tags: ['Conventions'],
        parameters: [parametreId()],
        requestBody: corpsJson({
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['validee', 'refusee', 'a_corriger'] },
            motif: { type: 'string' }
          }
        }),
        responses: {
          200: reponseOk('Décision enregistrée', { $ref: '#/components/schemas/Convention' }),
          400: reponseErreur('Décision invalide ou motif manquant (MOTIF_REQUIRED)'),
          404: reponseErreur('Introuvable ou stage non affecté à cet encadrant'),
          409: reponseErreur('Convention non soumise (NOT_SUBMITTED)'),
          ...reponsesCommunes
        }
      }
    },

    // ----------------------------------------------------------------- Stages
    '/stages/{id}/encadrant': {
      patch: {
        summary: 'Affecter un encadrant académique à un stage (admin / responsable)',
        description: 'L\'encadrant doit avoir le rôle `responsable`. L\'encadrant et l\'étudiant sont notifiés.',
        tags: ['Stages'],
        parameters: [parametreId('id', 'Identifiant du stage')],
        requestBody: corpsJson({
          type: 'object',
          required: ['encadrant_id'],
          properties: { encadrant_id: { type: 'integer' } }
        }),
        responses: {
          200: reponseOk('Encadrant affecté', {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              etudiant_id: { type: 'integer' },
              encadrant_id: { type: 'integer' }
            }
          }),
          400: reponseErreur('encadrant_id manquant'),
          404: reponseErreur('Stage introuvable'),
          422: reponseErreur('Encadrant invalide (INVALID_SUPERVISOR)'),
          ...reponsesCommunes
        }
      }
    }
  }
};

module.exports = swaggerSpec;