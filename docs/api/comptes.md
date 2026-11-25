# Contrat d'API — Module A : Comptes et accès

Base : `/api` · JSON · Documentation interactive : **`/api/docs`** (Swagger)
Authentification : en-tête `Authorization: Bearer <jeton>` (JWT HS256, durée `JWT_EXPIRES_IN`, 8 h par défaut).
En développement (`NODE_ENV=development` et `DEV_AUTH=true`), l'en-tête `x-dev-user: <id ou e-mail>` remplace le jeton (utile aux modules B et C).

## Format des réponses (règles du projet)

Succès : `{ "success": true, "data": ... }` (+ `"meta"` pour les listes, + `"message"` éventuel)
Erreur : `{ "success": false, "error": { "code": "...", "message": "..." } }`

| HTTP | `code`                                                                                               | Cas                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`, `WRONG_PASSWORD`, `SAME_PASSWORD`, `SELF_ACTION`, `SAME_ROLE`, `CSV_*`, `FILE_*` | Données ou fichier invalides                                                               |
| 401  | `INVALID_CREDENTIALS`                                                                                | E-mail **ou** mot de passe faux (message identique)                                        |
| 401  | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`, `ACCOUNT_DISABLED`               | Jeton absent / invalide / expiré, compte désactivé                                         |
| 403  | `FORBIDDEN`                                                                                          | Rôle insuffisant                                                                           |
| 403  | `PASSWORD_CHANGE_REQUIRED`                                                                           | Première connexion : changer le mot de passe d'abord                                       |
| 403  | `ACCOUNT_DISABLED`                                                                                   | Connexion d'un compte désactivé (mot de passe correct)                                     |
| 404  | `USER_NOT_FOUND`                                                                                     |                                                                                            |
| 409  | `EMAIL_ALREADY_EXISTS`, `REFERENCE_CONFLICT`, `PROFILE_MISSING`                                      | Doublon, compte lié à d'autres données                                                     |
| 422  | `ENTREPRISE_NOT_FOUND`                                                                               | Tuteur rattaché à une entreprise inexistante                                               |
| 429  | `TOO_MANY_ATTEMPTS`                                                                                  | 5 échecs de connexion par e-mail sur 15 min (`LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MINUTES`) |

## Rôles

`admin` · `responsable` · `etudiant` · `entreprise`. Un **tuteur** est un compte de rôle `entreprise` rattaché à une entreprise (table `tuteurs`).

## Authentification

### `POST /auth/login`

Corps : `{ "email": "...", "mot_de_passe": "..." }`
Réponse 200 :

```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "premiere_connexion": true,
    "utilisateur": {
      "id": 3,
      "nom": "Diop",
      "prenom": "Awa",
      "email": "awa@exemple.sn",
      "role": "etudiant",
      "statut": "actif",
      "profil": { "filiere": "Génie Informatique", "niveau": "Licence 3" }
    }
  }
}
```

Si `premiere_connexion` vaut `true`, toutes les autres routes répondent `403 PASSWORD_CHANGE_REQUIRED` tant que le mot de passe n'est pas changé.

### `GET /auth/moi` — profil de l'utilisateur connecté

### `POST /auth/changer-mot-de-passe`

Corps : `{ "ancien_mot_de_passe": "...", "nouveau_mot_de_passe": "..." }` (8 caractères min., une lettre et un chiffre, différent de l'ancien).
Réponse 200 : `{ "success": true, "message": "...", "data": { "token": "<nouveau jeton>" } }`

La déconnexion est côté client (suppression du jeton).

## Utilisateurs (rôle `admin` uniquement)

| Méthode | Route                                             | Description                                                         |
| ------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| GET     | `/utilisateurs?q=&role=&statut=&page=1&limite=20` | Liste → `{ data: [...], meta: { total, page, limite } }`            |
| GET     | `/utilisateurs/options/entreprises`               | `[{ id, raison_sociale }]` pour rattacher un tuteur                 |
| GET     | `/utilisateurs/:id`                               | Détail + profil                                                     |
| POST    | `/utilisateurs`                                   | Création → `201 { data: { utilisateur, mot_de_passe_temporaire } }` |
| PUT     | `/utilisateurs/:id`                               | Modification partielle (`nom`, `prenom`, `email`, `profil`)         |
| PATCH   | `/utilisateurs/:id/role`                          | Attribution d'un autre rôle `{ role, profil }`                      |
| PATCH   | `/utilisateurs/:id/desactiver` · `/activer`       | Statut `desactive` / `actif`                                        |
| POST    | `/utilisateurs/import-etudiants`                  | Import CSV (`multipart/form-data`, champ `fichier`)                 |

### Création : `POST /utilisateurs`

```json
{
  "nom": "Fall",
  "prenom": "Moussa",
  "email": "m.fall@entreprise.sn",
  "role": "entreprise",
  "profil": { "entreprise_id": 3, "fonction": "Directeur technique" }
}
```

`profil` selon le rôle : `etudiant` → `filiere`, `niveau` · `entreprise` → `entreprise_id` (obligatoire), `fonction` · `admin` / `responsable` → rien.
Le mot de passe temporaire (10 caractères) est généré par le serveur et **retourné une seule fois**.

### Import CSV

En-tête : `nom,prenom,email,filiere,niveau` (séparateur `,` ou `;`, 1 Mo et 500 lignes max). Chaque ligne est traitée dans sa propre transaction :

```json
{
  "success": true,
  "data": {
    "total_lignes": 4,
    "crees": 2,
    "comptes": [
      {
        "ligne": 2,
        "nom": "Ba",
        "prenom": "Ibrahima",
        "email": "...",
        "mot_de_passe_temporaire": "..."
      }
    ],
    "erreurs": [
      {
        "ligne": 3,
        "email": "pas-un-email",
        "motif": "email : e-mail invalide"
      }
    ]
  }
}
```

`ligne` = numéro de ligne dans le fichier (l'en-tête est la ligne 1).

### Règles

- Un administrateur ne peut ni désactiver son propre compte, ni changer son propre rôle.
- Un compte désactivé ne peut plus se connecter ; ses jetons déjà émis sont refusés (statut relu en base à chaque requête).
- Changer de rôle supprime le profil de l'ancien rôle ; refusé (`409 REFERENCE_CONFLICT`) si ce profil est déjà référencé ailleurs.

## Pour les modules B et C

```js
const { authentifier, exigerRole } = require("../middleware/auth");
router.get("/mes-candidatures", authentifier, exigerRole("etudiant"), handler); // req.utilisateur = { id, role, ... }
```

`authentifier` garde la même signature qu'avant (aucun changement de code nécessaire). Mode DEV : voir en haut de ce document.
