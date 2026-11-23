# Plateforme de Gestion des Stages

## Versions requises
- **Node.js :** v24.22.3 LTS
- **npm :** v11.19.1
- **PostgreSQL :** v19

## Installation
1. `git clone <url-du-depot> && cd gestion-stages`
2. `npm install`
3. Copier `.env.example` vers `.env` et renseigner vos accès PostgreSQL
4. Créer la base : `CREATE DATABASE gestion_stages;`
5. Initialiser la base : `npm run db:reset`
6. Lancer le serveur : `npm run dev` (accessible sur `http://localhost:3000`)

## Validation
- Healthcheck : `GET /health`
- Mode dev : utiliser l'en-tête `x-dev-user` (ID ou email) lorsque `DEV_AUTH=true`.