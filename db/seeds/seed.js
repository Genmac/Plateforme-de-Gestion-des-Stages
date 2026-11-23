const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log(' Seed-Message : Lancement du remplissage (seed) de la base de données...');
    
    const seedFilePath = path.join(__dirname, '000_socle.sql');
    if (!fs.existsSync(seedFilePath)) {
      console.error('Seed-Message(erreur) : Fichier 000_socle.sql introuvable dans db/seeds/.');
      process.exit(1);
    }

    const sql = fs.readFileSync(seedFilePath, 'utf8');
    await client.query(sql);

    console.log('Seed-Message(succes) : Données de test insérées avec succès !');
  } catch (error) {
    console.error('Seed-Message(erreur) : Erreur lors du seed :', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();