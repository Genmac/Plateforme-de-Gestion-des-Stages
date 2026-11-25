// Execute db/seeds/*.sql (ordre alphabetique) puis hache les mots de passe en clair des comptes de demo.
// (Ancienne version : copie de migrate.js, qui plantait sur de mauvais chemins.)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool } = require("../../src/config/db");

async function runSeeds() {
  const fichiers = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    console.log(
      "Seed-Message : Démarrage de l'insertion des données de démo...",
    );
    await client.query("BEGIN");

    for (const fichier of fichiers) {
      console.log(`Seed-Message : Exécution de ${fichier}`);
      await client.query(
        fs.readFileSync(path.join(__dirname, fichier), "utf8"),
      );
    }

    // Les seeds contiennent des mots de passe en clair : on les hache (bcrypt) pour permettre la connexion.
    // Les comptes de démo n'ont pas à changer leur mot de passe à la première connexion.
    const { rows } = await client.query(
      "SELECT id, mot_de_passe FROM utilisateurs WHERE mot_de_passe NOT LIKE '$2%'",
    );
    const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    for (const u of rows) {
      const hash = await bcrypt.hash(u.mot_de_passe, rounds);
      await client.query(
        "UPDATE utilisateurs SET mot_de_passe = $1, premiere_connexion = FALSE WHERE id = $2",
        [hash, u.id],
      );
    }
    console.log(`Seed-Message : ${rows.length} mot(s) de passe haché(s).`);

    await client.query("COMMIT");
    console.log("Seed-Message(succes) : Données de démo insérées.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed-Message(erreur) :", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeeds();
