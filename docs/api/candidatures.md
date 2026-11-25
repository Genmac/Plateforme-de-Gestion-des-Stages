# API Entreprises & Candidatures (module B)

Base : `http://localhost:3000/api`. Spécification interactive : `/api/docs` (voir plus bas).

## Authentification

- **Production** : en-tête `Authorization: Bearer <jeton JWT>`.
- **Développement** (`NODE_ENV=development` et `DEV_AUTH=true`) : en-tête `x-dev-user: <id ou email>`.

## Format des réponses

Succès : `{ "success": true, "data": ... }`

Erreur : `{ "success": false, "error": { "code": "...", "message": "..." } }`

## Rôles

| Rôle | Entreprises | Candidatures |
|---|---|---|
| `etudiant` | lister (validées + ses propositions), proposer | créer, lire les siennes, changer le statut, déposer des documents |
| `admin`, `responsable` | tout, valider, rejeter, modifier | lecture seule de toutes les candidatures |
| `entreprise` | aucun accès (403) | aucun accès (403) |

## Entreprises

| Méthode | Route | Rôles | Description |
|---|---|---|---|
| GET | `/entreprises?q=&statut=` | étudiant, admin, responsable | Liste et recherche par nom |
| GET | `/entreprises/:id` | idem | Détail |
| POST | `/entreprises` | idem | Créer (admin : `validee`) ou proposer (étudiant : `a_valider`) |
| PUT | `/entreprises/:id` | admin, responsable | Modifier (champs omis inchangés) |
| PATCH | `/entreprises/:id/valider` | admin, responsable | Valider une proposition |
| PATCH | `/entreprises/:id/rejeter` | admin, responsable | Rejeter une proposition |

Statuts : `a_valider`, `validee`, `rejetee`.

**Alerte de doublon.** Si une entreprise de même nom existe (casse ignorée), `POST /entreprises` répond `409` :

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_WARNING",
    "message": "Une entreprise portant ce nom existe déjà. Confirmez pour la créer quand même.",
    "doublons": [{ "id": 8, "raison_sociale": "Orange Senegal", "statut": "validee" }]
  }
}
```

Pour créer malgré tout, renvoyer la même requête avec `"confirmer_doublon": true`.

**Notifications.** À chaque proposition d'un étudiant, tous les `admin` et `responsable` sont notifiés. Quand une proposition est validée ou rejetée, le proposant est notifié.

## Candidatures

| Méthode | Route | Rôles | Description |
|---|---|---|---|
| GET | `/candidatures` | étudiant, admin, responsable | Étudiant : les siennes ; admin : toutes |
| GET | `/candidatures/:id` | idem | Détail + historique + documents |
| POST | `/candidatures` | étudiant | Enregistrer une candidature |
| PATCH | `/candidatures/:id/statut` | étudiant (propriétaire) | Changer le statut |
| POST | `/candidatures/:id/documents` | étudiant (propriétaire) | Déposer un document |
| GET | `/candidatures/:id/documents/:docId` | propriétaire, admin, responsable | Télécharger |

### Créer une candidature

```json
POST /api/candidatures
{ "entreprise_id": 8, "poste": "Stagiaire développeur", "contact": "Service RH", "date_candidature": "2026-11-24" }
```

`contact` et `date_candidature` sont facultatifs (date par défaut : aujourd'hui). L'entreprise doit être `validee`, sinon `422 ENTREPRISE_NOT_VALIDATED`.

### Statuts et règles

Statuts : `envoyee` (initial), `en_attente`, `entretien`, `acceptee`, `refusee`, `retiree`.

- `refusee` et `retiree` sont **définitifs** : tout changement ou dépôt ensuite renvoie `409 FINAL_STATUS`.
- Passer à `acceptee` exige un document `preuve_acceptation`, sinon `422 PROOF_REQUIRED`.
- Chaque changement (et la création) ajoute une ligne datée à l'historique, dans la même transaction.

```json
PATCH /api/candidatures/12/statut
{ "statut": "entretien" }
```

### Documents

`POST /candidatures/:id/documents` en `multipart/form-data` :

| Champ | Valeur |
|---|---|
| `type` | `cv`, `lettre` ou `preuve_acceptation` |
| `fichier` | PDF, JPEG, PNG ou WEBP, 10 Mo maximum |

Le contenu réel du fichier est vérifié (signature des premiers octets), pas seulement le type déclaré. Un nouveau dépôt du même type **remplace** le précédent.

```bash
curl -X POST http://localhost:3000/api/candidatures/12/documents \
  -H "x-dev-user: 3" -F "type=cv" -F "fichier=@cv.pdf;type=application/pdf"
```

### Réponse du détail

```json
{
  "success": true,
  "data": {
    "id": 12, "etudiant_id": 3, "entreprise_id": 8, "entreprise": "Orange Senegal",
    "poste": "Stagiaire développeur", "contact": "Service RH",
    "date_candidature": "2026-11-24", "statut": "acceptee",
    "historique": [
      { "ancien_statut": null, "nouveau_statut": "envoyee", "change_par": 3, "change_le": "2026-11-24T10:00:00.000Z" },
      { "ancien_statut": "envoyee", "nouveau_statut": "acceptee", "change_par": 3, "change_le": "2026-11-24T10:05:00.000Z" }
    ],
    "documents": [
      { "id": 2, "type": "cv", "nom_original": "cv.pdf", "mime_type": "application/pdf", "taille": 24512, "depose_le": "2026-11-24T10:01:00.000Z" }
    ]
  }
}
```

## Codes d'erreur

| HTTP | Code | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Champ manquant ou invalide, type de document ou statut inconnu |
| 400 | `INVALID_ID` | Identifiant non numérique |
| 400 | `NO_FILE` | Aucun fichier reçu |
| 400 | `INVALID_FILE_TYPE` | Type non autorisé (hors PDF, JPEG, PNG, WEBP) |
| 400 | `INVALID_FILE_CONTENT` | Contenu différent du type déclaré |
| 401 | `UNAUTHORIZED` | Authentification manquante |
| 403 | `FORBIDDEN` | Rôle insuffisant |
| 404 | `*_NOT_FOUND` | Ressource inexistante **ou appartenant à un autre étudiant** |
| 409 | `DUPLICATE_WARNING` | Nom d'entreprise déjà existant |
| 409 | `NOT_PENDING` | Entreprise déjà traitée |
| 409 | `SAME_STATUS` | La candidature a déjà ce statut |
| 409 | `FINAL_STATUS` | Candidature refusée ou retirée |
| 413 | `FILE_TOO_LARGE` | Fichier de plus de 10 Mo |
| 422 | `ENTREPRISE_NOT_VALIDATED` | Candidature vers une entreprise non validée |
| 422 | `PROOF_REQUIRED` | « acceptée » sans preuve d'acceptation |

## Sécurité

- Un étudiant ne voit jamais les candidatures ni les documents d'autrui : la réponse est un `404` (et non `403`) pour ne pas révéler leur existence.
- Les documents ne sont téléchargeables que par `GET /candidatures/:id/documents/:docId`, qui contrôle les droits.

## Tests

`npm test` lance `tests/candidatures.test.js` (19 tests : doublon, fichiers refusés, preuve obligatoire, isolation entre étudiants).