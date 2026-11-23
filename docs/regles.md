# Règles de développement — Gestion des Stages

## 1. Cloisonnement & Arborescence
- **Backend :** `src/controllers/`, `src/routes/` (un fichier par ressource)
- **Frontend :** `public/js/modules/`
- **Migrations SQL :** `db/migrations/` préfixées (`a_*.sql`, `b_*.sql`, `c_*.sql`)
- **Interdit :** Ne jamais modifier `src/server.js` ni `src/routes/index.js`.

## 2. Format de réponse API
- **Succès :** `{ "success": true, "data": ... }`
- **Erreur :** `{ "success": false, "error": { "code": "...", "message": "..." } }`

## 3. Rôles & Responsabilités
- **Rôles :** `admin`, `responsable`, `etudiant`, `entreprise`
- **Membre A (Pilote) :** Socle, Auth, Comptes/Utilisateurs, Notifications
- **Membre B :** Entreprises, Candidatures
- **Membre C :** Stages, Conventions