const express = require('express');
const swaggerUi = require('swagger-ui-express');
const spec = require('../config/swagger');

const router = express.Router();

// Spécification brute (utilisable dans Postman, Insomnia, etc.)
router.get('/swagger.json', (req, res) => res.status(200).json(spec));

// Interface interactive : /api/docs
router.use('/', swaggerUi.serve, swaggerUi.setup(spec));

module.exports = router;