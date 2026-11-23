const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Migration-Message : Démarrage des migrations de la base de données...');

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error('Migration-Message(erreur) : Le dossier db/migrations/ est introuvable.');
      process.exit(1);
    }

    // Lit et trie les fichiers par ordre alphabétique (000_socle.sql en premier, puis a_*, b_*, etc.)
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('Migration-Message : Aucun fichier de migration trouvé.');
      return;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Migration-Message : Exécution de la migration : ${file}`);
      await client.query(sql);
    }

    console.log('Migration-Message(succes) : Toutes les migrations ont été exécutées avec succès !');
  } catch (error) {
    console.error('Migration-Message(erreur) : Erreur lors de l\'exécution des migrations :', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();