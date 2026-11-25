const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function runMigrations() {
  const isReset = process.argv.includes('--reset');

  // bloquer la reinitialisation en production avant toute connexion
  if (isReset && process.env.NODE_ENV === 'production') {
    console.error('Migration-Message(erreur) : L\'option --reset est interdite en production.');
    process.exitCode = 1;
    await pool.end();
    return;
  }

  // Vérifier que le dossier migrations existe
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('Migration-Message(erreur) : Le dossier db/migrations/ est introuvable.');
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    console.log('Migration-Message : Démarrage des migrations de la base de données...');

    if (isReset) {
      console.log('Migration-Message : Réinitialisation complète du schéma public...');
      await client.query(`
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO public;
      `);
    }

    // Table de suivi pour rendre les migrations idempotentes
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('Migration-Message : Aucun fichier de migration trouvé.');
      return;
    }

    for (const file of files) {
      const alreadyRun = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [file]
      );

      if (alreadyRun.rows.length > 0) {
        console.log(`Migration-Message : Migration ignorée (déjà exécutée) : ${file}`);
        continue;
      }

      console.log(`Migration-Message : Exécution de la migration : ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`Migration-Message(succes) : Migration validée : ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Migration-Message(erreur) : Échec et ROLLBACK sur ${file} :`, err.message);
        throw err;
      }
    }

    console.log('Migration-Message(succes) : Toutes les migrations ont été exécutées avec succès !');
  } catch (error) {
    console.error('Migration-Message(erreur) : Erreur lors de l\'exécution des migrations :', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();