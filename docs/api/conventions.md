# API Stages & Conventions (module C)

Base : `http://localhost:3000/api`. Spécification interactive : `/api/docs`.

## Authentification et format

- **Production** : `Authorization: Bearer <jeton JWT>`.
- **Développement** (`NODE_ENV=development`, `DEV_AUTH=true`) : `x-dev-user: <id ou email>`.
- Succès : `{ "success": true, "data": ... }`
- Erreur : `{ "success": false, "error": { "code": "...", "message": "..." } }`

## Rôles

| Rôle | Rôle métier | Droits sur les conventions |
|---|---|---|
| `etudiant` | Étudiant | Créer, modifier, soumettre **ses** conventions |
| `entreprise` | Tuteur en entreprise | Lire celles où il est désigné (`tuteur_id`) |
| `responsable` | Encadrant académique | Lire celles de ses stages, valider / refuser / demander une correction |
| `admin` | Administration | Tout lire, décider, affecter un encadrant |

L'encadrant académique est désigné par l'administration (`stages.encadrant_id`) et doit avoir le rôle `responsable`.

## Routes

| Méthode | Route | Rôles | Description |
|---|---|---|---|
| GET | `/conventions?a_traiter=&statut=` | tous | Liste filtrée par visibilité |
| GET | `/conventions/options` | tous | Entreprises (avec tuteur) et encadrants |
| GET | `/conventions/:id` | tous | Fiche avec historique |
| POST | `/conventions` | étudiant | Créer stage + convention en brouillon |
| PUT | `/conventions/:id` | étudiant | Modifier / reprendre (brouillon ou à corriger) |
| POST | `/conventions/:id/soumettre` | étudiant | Soumettre |
| PATCH | `/conventions/:id/decision` | responsable, admin | Valider, refuser, demander une correction |
| PATCH | `/stages/:id/encadrant` | admin, responsable | Affecter l'encadrant |

## Statuts de convention

`brouillon` → `soumise` → `validee` | `refusee` | `a_corriger`. Depuis `a_corriger`, l'étudiant modifie puis soumet à nouveau. `soumise`, `validee` et `refusee` sont verrouillées (409 `LOCKED`).

## Règles métier

- **Brouillon** : aucun champ obligatoire. Les champs sont vérifiés **à la soumission** (422 `INCOMPLETE`, liste dans `error.manquants`) : `entreprise_id`, `tuteur_id`, `sujet`, `missions`, `gratification`, `date_debut`, `date_fin`.
- **Dates** : `date_fin` doit être postérieure à `date_debut` (400 `INVALID_DATES`), contrôle doublé par un `CHECK` en base.
- **Un seul stage actif par étudiant** : 409 `ACTIVE_STAGE_EXISTS` (garanti aussi par un index unique partiel).
- **Motif** obligatoire pour `refusee` et `a_corriger` (400 `MOTIF_REQUIRED`).
- **Historique** : chaque changement (création, soumission, décision) est inscrit dans la même transaction (qui, quand, avant, après, commentaire).
- **Tuteur** : doit être un utilisateur de rôle `entreprise` (422 `INVALID_TUTOR`).
- **Candidature** : `candidature_id` est un simple entier, sans clé étrangère, donc le module fonctionne sans le module B.

## Notifications

- À la soumission : tuteur et encadrant ; à défaut d'encadrant, tous les `admin` et `responsable`.
- À la décision : l'étudiant (avec le motif).
- À l'affectation : l'encadrant et l'étudiant.

## Exemples

```json
POST /api/conventions
{ "sujet": "Application de suivi logistique", "origine": "initiative_etudiant" }
```

```json
PUT /api/conventions/12
{ "entreprise_id": 1, "tuteur_id": 8, "missions": "Développement du module de suivi.",
  "gratification": 60000, "date_debut": "2027-02-01", "date_fin": "2027-07-31" }
```

```json
PATCH /api/conventions/12/decision
{ "decision": "a_corriger", "motif": "Préciser les missions." }
```

Réponse d'une soumission incomplète :

```json
{
  "success": false,
  "error": {
    "code": "INCOMPLETE",
    "message": "Convention incomplète. Champs manquants : missions, date_debut.",
    "manquants": ["missions", "date_debut"]
  }
}
```

## Codes d'erreur

| HTTP | Code | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Format invalide (identifiant, origine, gratification, date), décision inconnue |
| 400 | `INVALID_DATES` | Fin avant début |
| 400 | `MOTIF_REQUIRED` | Refus ou correction sans motif |
| 400 | `INVALID_ID` | Identifiant non numérique |
| 403 | `FORBIDDEN` | Rôle insuffisant |
| 404 | `CONVENTION_NOT_FOUND` | Inexistante, ou **non visible** pour ce rôle (existence non révélée) |
| 404 | `STAGE_NOT_FOUND` | Stage inexistant |
| 409 | `ACTIVE_STAGE_EXISTS` | L'étudiant a déjà un stage actif |
| 409 | `LOCKED` | Convention non modifiable dans son statut actuel |
| 409 | `NOT_SUBMITTED` | Décision sur une convention non soumise |
| 422 | `INCOMPLETE` | Champs obligatoires manquants à la soumission |
| 422 | `INVALID_TUTOR` | Le tuteur n'est pas de rôle `entreprise` |
| 422 | `INVALID_SUPERVISOR` | L'encadrant n'est pas de rôle `responsable` |
| 422 | `ENTREPRISE_NOT_FOUND` | Entreprise inexistante |

## Tests

`npm test` lance `tests/conventions.test.js` (brouillon incomplet accepté, soumission incomplète refusée, second stage actif refusé, refus sans motif refusé, convention d'un autre étudiant inaccessible, historique complet).