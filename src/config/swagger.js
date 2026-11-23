const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'API Gestion des Stages',
    version: '1.0.0',
    description: 'Documentation API du socle et des modules (Comptes, Candidatures, Conventions).'
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
    }
  },
  security: [{ bearerAuth: [] }, { devUserHeader: [] }],
  paths: {
    '/notifications': {
      get: {
        summary: 'Lister les notifications de l’utilisateur connecté',
        tags: ['Socle - Notifications'],
        responses: {
          200: { description: 'Liste des notifications récupérée avec succès' }
        }
      }
    }
  }
};

module.exports = swaggerSpec;