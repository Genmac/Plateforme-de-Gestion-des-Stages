// Tests du module A (Comptes et accès)

process.env.PORT = "0"; // le serveur du socle écoute dès son chargement : port libre aléatoire
process.env.LOGIN_MAX_ATTEMPTS = "5";
process.env.BCRYPT_ROUNDS = "4"; // plus rapide en test
require("dotenv").config();
process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/server");
const db = require("../src/config/db");

const DOMAINE = "@comptes-test.local";
const SUFFIXE = Date.now().toString(36);
const mail = (nom) => `${nom}.${SUFFIXE}${DOMAINE}`;
const MDP = "Test1234";

let admin, etudiant, desactive, entrepriseId, jetonAdmin;

async function creerDirect(
  roleNom,
  nom,
  { statut = "actif", premiere = false } = {},
) {
  const hash = await bcrypt.hash(MDP, 4);
  const { rows } = await db.query(
    `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role_id, statut, premiere_connexion)
     VALUES ($1, 'Test', $2, $3, (SELECT id FROM roles WHERE nom = $4), $5, $6) RETURNING id`,
    [nom, mail(nom), hash, roleNom, statut, premiere],
  );
  if (roleNom === "etudiant") {
    await db.query(
      "INSERT INTO etudiants (utilisateur_id, filiere, niveau) VALUES ($1, 'Génie Informatique', 'Licence 3')",
      [rows[0].id],
    );
  }
  return { id: rows[0].id, email: mail(nom) };
}

const connexion = (email, motDePasse = MDP) =>
  request(app)
    .post("/api/auth/login")
    .send({ email, mot_de_passe: motDePasse });
const avec = (jeton) => (req) => req.set("Authorization", `Bearer ${jeton}`);

describe("Module A — Comptes et accès", () => {
  before(async () => {
    admin = await creerDirect("admin", "admin");
    etudiant = await creerDirect("etudiant", "etu");
    desactive = await creerDirect("etudiant", "inactif", {
      statut: "desactive",
    });
    const e = await db.query(
      "INSERT INTO entreprises (raison_sociale) VALUES ('Entreprise Test Comptes') RETURNING id",
    );
    entrepriseId = e.rows[0].id;
    jetonAdmin = (await connexion(admin.email)).body.data.token;
  });

  after(async () => {
    await db.query("DELETE FROM utilisateurs WHERE email LIKE $1", [
      `%${DOMAINE}`,
    ]);
    await db.query("DELETE FROM entreprises WHERE id = $1", [entrepriseId]);
    await db.pool.end();
  });

  describe("Connexion", () => {
    it("connexion OK : jeton JWT à expiration, sans mot de passe dans la réponse", async () => {
      const res = await connexion(etudiant.email);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.utilisateur.role, "etudiant");
      assert.equal(res.body.data.utilisateur.mot_de_passe, undefined);
      assert.ok(jwt.decode(res.body.data.token).exp, "le jeton doit expirer");
    });

    it("connexion KO : même message si l'e-mail ou le mot de passe est faux", async () => {
      const mauvaisMdp = await connexion(etudiant.email, "Mauvais1234");
      const mauvaisMail = await connexion(`inconnu.${SUFFIXE}${DOMAINE}`, MDP);
      assert.equal(mauvaisMdp.status, 401);
      assert.equal(mauvaisMail.status, 401);
      assert.equal(mauvaisMdp.body.error.code, "INVALID_CREDENTIALS");
      assert.equal(
        mauvaisMail.body.error.message,
        mauvaisMdp.body.error.message,
      );
    });

    it("limitation des tentatives : 429 après 5 échecs", async () => {
      const cible = mail("bruteforce");
      for (let i = 0; i < 5; i += 1) {
        assert.equal((await connexion(cible, "Faux12345")).status, 401);
      }
      const res = await connexion(cible, "Faux12345");
      assert.equal(res.status, 429);
      assert.equal(res.body.error.code, "TOO_MANY_ATTEMPTS");
    });

    it("compte désactivé : connexion refusée", async () => {
      const res = await connexion(desactive.email);
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, "ACCOUNT_DISABLED");
    });

    it("compte désactivé après connexion : le jeton déjà émis est refusé", async () => {
      const tmp = await creerDirect("etudiant", "tmp");
      const { token } = (await connexion(tmp.email)).body.data;
      await db.query(
        "UPDATE utilisateurs SET statut = 'desactive' WHERE id = $1",
        [tmp.id],
      );
      const res = await request(app)
        .get("/api/auth/moi")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "ACCOUNT_DISABLED");
    });
  });

  describe("Protection des routes", () => {
    it("route protégée sans jeton : 401", async () => {
      const res = await request(app).get("/api/utilisateurs");
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "UNAUTHORIZED");
    });

    it("mauvais rôle : un étudiant est refusé sur les routes d'administration (403)", async () => {
      const { token } = (await connexion(etudiant.email)).body.data;
      const liste = await request(app)
        .get("/api/utilisateurs")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(liste.status, 403);
      assert.equal(liste.body.error.code, "FORBIDDEN");
      const creation = await request(app)
        .post("/api/utilisateurs")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      assert.equal(creation.status, 403);
    });

    it("jeton expiré : 401 TOKEN_EXPIRED", async () => {
      const expire = jwt.sign(
        {
          id: admin.id,
          role: "admin",
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        process.env.JWT_SECRET,
      );
      const res = await request(app)
        .get("/api/utilisateurs")
        .set("Authorization", `Bearer ${expire}`);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "TOKEN_EXPIRED");
    });

    it("jeton falsifié : 401 INVALID_TOKEN", async () => {
      const faux = jwt.sign({ id: admin.id, role: "admin" }, "autre-secret");
      const res = await request(app)
        .get("/api/utilisateurs")
        .set("Authorization", `Bearer ${faux}`);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "INVALID_TOKEN");
    });
  });

  describe("Administration des comptes", () => {
    const admReq = (r) => avec(jetonAdmin)(r);

    it("créer un étudiant, connexion, changement obligatoire du mot de passe", async () => {
      const creation = await admReq(
        request(app).post("/api/utilisateurs"),
      ).send({
        nom: "Diop",
        prenom: "Awa",
        email: mail("awa"),
        role: "etudiant",
        profil: { filiere: "Génie Informatique", niveau: "Licence 3" },
      });
      assert.equal(creation.status, 201);
      const temporaire = creation.body.data.mot_de_passe_temporaire;
      assert.ok(temporaire);
      assert.equal(creation.body.data.utilisateur.mot_de_passe, undefined);

      const login = await connexion(mail("awa"), temporaire);
      assert.equal(login.status, 200);
      assert.equal(login.body.data.premiere_connexion, true);
      const jeton = login.body.data.token;

      // Avant le changement, les autres routes sont bloquées
      const bloque = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${jeton}`);
      assert.equal(bloque.status, 403);
      assert.equal(bloque.body.error.code, "PASSWORD_CHANGE_REQUIRED");

      const faible = await request(app)
        .post("/api/auth/changer-mot-de-passe")
        .set("Authorization", `Bearer ${jeton}`)
        .send({
          ancien_mot_de_passe: temporaire,
          nouveau_mot_de_passe: "court",
        });
      assert.equal(faible.status, 400);

      const change = await request(app)
        .post("/api/auth/changer-mot-de-passe")
        .set("Authorization", `Bearer ${jeton}`)
        .send({
          ancien_mot_de_passe: temporaire,
          nouveau_mot_de_passe: "NouveauMdp42",
        });
      assert.equal(change.status, 200);

      const relogin = await connexion(mail("awa"), "NouveauMdp42");
      assert.equal(relogin.status, 200);
      assert.equal(relogin.body.data.premiere_connexion, false);
      assert.equal((await connexion(mail("awa"), temporaire)).status, 401);
      const notifs = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${relogin.body.data.token}`);
      assert.equal(notifs.status, 200);
    });

    it("créer un tuteur (rôle entreprise) rattaché à une entreprise", async () => {
      const res = await admReq(request(app).post("/api/utilisateurs")).send({
        nom: "Fall",
        prenom: "Moussa",
        email: mail("tuteur"),
        role: "entreprise",
        profil: {
          entreprise_id: entrepriseId,
          fonction: "Directeur technique",
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.utilisateur.role, "entreprise");
      assert.equal(
        res.body.data.utilisateur.profil.entreprise_id,
        entrepriseId,
      );

      const inconnue = await admReq(
        request(app).post("/api/utilisateurs"),
      ).send({
        nom: "X",
        prenom: "Y",
        email: mail("tuteur2"),
        role: "entreprise",
        profil: { entreprise_id: 99999999 },
      });
      assert.equal(inconnue.status, 422);
      assert.equal(inconnue.body.error.code, "ENTREPRISE_NOT_FOUND");
    });

    it("validation : champs manquants et e-mail déjà utilisé", async () => {
      const invalide = await admReq(
        request(app).post("/api/utilisateurs"),
      ).send({ nom: "Seul" });
      assert.equal(invalide.status, 400);
      assert.equal(invalide.body.error.code, "VALIDATION_ERROR");
      const doublon = await admReq(request(app).post("/api/utilisateurs")).send(
        {
          nom: "Doublon",
          prenom: "Test",
          email: etudiant.email,
          role: "responsable",
        },
      );
      assert.equal(doublon.status, 409);
      assert.equal(doublon.body.error.code, "EMAIL_ALREADY_EXISTS");
    });

    it("liste : recherche et filtre par rôle", async () => {
      const res = await admReq(request(app).get("/api/utilisateurs")).query({
        q: SUFFIXE,
        role: "entreprise",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].role, "entreprise");
      assert.equal(res.body.meta.total, 1);
    });

    it("désactiver puis réactiver un compte ; auto-désactivation interdite", async () => {
      const off = await admReq(
        request(app).patch(`/api/utilisateurs/${etudiant.id}/desactiver`),
      );
      assert.equal(off.status, 200);
      assert.equal(off.body.data.statut, "desactive");
      assert.equal((await connexion(etudiant.email)).status, 403);

      const on = await admReq(
        request(app).patch(`/api/utilisateurs/${etudiant.id}/activer`),
      );
      assert.equal(on.body.data.statut, "actif");
      assert.equal((await connexion(etudiant.email)).status, 200);

      const soi = await admReq(
        request(app).patch(`/api/utilisateurs/${admin.id}/desactiver`),
      );
      assert.equal(soi.status, 400);
    });

    it("attribuer un rôle : étudiant -> responsable", async () => {
      const cible = await creerDirect("etudiant", "rolechg");
      const res = await admReq(
        request(app).patch(`/api/utilisateurs/${cible.id}/role`),
      ).send({ role: "responsable" });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.role, "responsable");
      const reste = await db.query(
        "SELECT 1 FROM etudiants WHERE utilisateur_id = $1",
        [cible.id],
      );
      assert.equal(
        reste.rowCount,
        0,
        "l'ancien profil étudiant doit être supprimé",
      );
    });

    it("import CSV : les lignes en erreur sont listées sans bloquer les autres", async () => {
      const csv = [
        "nom,prenom,email,filiere,niveau",
        `Ba,Ibrahima,${mail("imp1")},Génie Logiciel,Licence 3`,
        "Sow,Fatou,pas-un-email,Génie Logiciel,Licence 3",
        `Ndiaye,Cheikh,${mail("imp3")},Réseaux,Master 1`,
        `Doublon,Mail,${mail("imp1")},Réseaux,Master 1`,
      ].join("\n");
      const res = await admReq(
        request(app).post("/api/utilisateurs/import-etudiants"),
      ).attach("fichier", Buffer.from(csv), "etudiants.csv");
      assert.equal(res.status, 200);
      assert.equal(res.body.data.total_lignes, 4);
      assert.equal(res.body.data.crees, 2);
      assert.deepEqual(
        res.body.data.erreurs.map((e) => e.ligne).sort(),
        [3, 5],
      );
      assert.ok(res.body.data.comptes[0].mot_de_passe_temporaire);
    });

    it("import CSV : un fichier qui n'est pas .csv est refusé", async () => {
      const res = await admReq(
        request(app).post("/api/utilisateurs/import-etudiants"),
      ).attach("fichier", Buffer.from("x"), "etudiants.txt");
      assert.equal(res.status, 400);
    });
  });

  describe("Documentation", () => {
    it("Swagger est accessible sur /api/docs", async () => {
      const res = await request(app).get("/api/docs/");
      assert.equal(res.status, 200);
    });
  });
});

// Le serveur du socle (app.listen dans server.js) garde le processus ouvert : on le ferme après les tests.
after(() => {
  setTimeout(() => process.exit(), 150);
});
