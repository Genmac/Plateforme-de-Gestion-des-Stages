const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const routes = require('./routes');
const gestionnaireErreurs = require('./middleware/erreurs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques et uploads
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Endpoint /health
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Montage automatique des routes
app.use('/api', routes);

// Application du middleware centralisé des erreurs
app.use(gestionnaireErreurs);

app.listen(PORT, () => {
  console.log(`Serveur démarré et à l'écoute sur http://localhost:${PORT}`);
});

module.exports = app;