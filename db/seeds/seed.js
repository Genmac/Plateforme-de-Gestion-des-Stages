const fs = require('fs');
const path = require('path');
const { pool } = require('../../src/config/db');

async function runSeed() {
  //interdire le seeding de données fictives en production avant toute connexion
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed-Message(erreur) : L\'exécution des seeds est interdite en production.');
    process.exitCode = 1;
    await pool.end();
    return;
  }

  //Récupérer et trier les fichiers .sql présents dans le dossier actuel
  const files = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('Seed-Message : Aucun fichier de seed (.sql) trouvé.');
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    console.log('Seed-Message : Démarrage de l\'insertion des seeds (transaction)...');
    await client.query('BEGIN');

    for (const file of files) {
      console.log(`Seed-Message : Exécution du seed : ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await client.query(sql);
      console.log(`Seed-Message(succes) : Seed chargé : ${file}`);
    }

    await client.query('COMMIT');
    console.log('Seed-Message(succes) : Tous les seeds ont été insérés avec succès !');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed-Message(erreur) : Échec et ROLLBACK des seeds :', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();