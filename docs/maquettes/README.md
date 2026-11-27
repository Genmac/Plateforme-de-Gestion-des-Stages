# Maquettes : module Entreprises & Candidatures 

Captures des écrans réalisés. Navigation par hash : `#entreprises` et `#entreprises/candidatures`.

## 1. Liste des entreprises (admin / responsable)

![Liste des entreprises](01-liste-entreprises.png)

Tableau des entreprises avec recherche par nom  et filtre par statut
(à valider, validée, rejetée). Un étudiant voit uniquement les entreprises validées et ses propres propositions.

## 2. Formulaire d'ajout ou de proposition

![Formulaire entreprise](02-formulaire-entreprise.png)

L'administration crée directement une entreprise « validée ». Un étudiant la propose : elle passe
en « à valider » et l'administration reçoit une notification.

## 3. Alerte de doublon

![Alerte de doublon](03-alerte-doublon.png)

Si le nom existe déjà (casse ignorée), l'API répond 409 avec la liste des doublons.
L'utilisateur peut annuler ou confirmer avec « Créer quand même ».

## 4. Validation par l'administration

![Validation](04-validation-admin.png)

L'administration valide, rejette ou modifie une entreprise proposée. Le proposant est notifié.

## 5. Mes candidatures (étudiant)

![Mes candidatures](05-mes-candidatures.png)

Suivi des candidatures et de leur statut : envoyée, en attente, entretien, acceptée, refusée, retirée.
L'administration voit toutes les candidatures en lecture seule.

## 6. Détail d'une candidature

![Détail d'une candidature](06-detail-candidature.png)

Changement de statut (« acceptée » exige une preuve d'acceptation), dépôt de documents
(CV, lettre, preuve ; PDF ou image, 10 Mo maximum), téléchargement protégé et historique daté des statuts.



---

# Module C : Stages & Conventions (issue #16)

Navigation par hash : `#conventions`, `#conventions/nouvelle`, `#conventions/<id>`, `#conventions/<id>/modifier`.

## 1. Liste (étudiant)
![Liste](c-01-liste-etudiant.png)

## 2. Formulaire en étapes : entreprise
![Étape 1](c-02-formulaire-etape1.png)

Quatre étapes (entreprise, sujet et missions, durée et gratification, récapitulatif). Chaque étape enregistre le brouillon.

## 3. Récapitulatif avant soumission
![Récapitulatif](c-03-formulaire-recap.png)

À la soumission, un champ manquant ramène à l'étape concernée.

## 4. Fiche d'une convention
![Fiche](c-04-fiche-convention.png)

Statut, informations, motif éventuel et historique de chaque changement (qui, quand, avant, après, commentaire).

## 5. Liste à traiter (administration, encadrant)
![À traiter](c-05-liste-a-traiter.png)

## 6. Décision
![Décision](c-06-decision.png)

Valider, demander une correction ou refuser ; motif obligatoire pour les deux derniers. L'administration affecte aussi l'encadrant académique.