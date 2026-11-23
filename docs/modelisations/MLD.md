A. Gestion des utilisateurs et des profils



ROLE(

&#x20;   id\_role PK,

&#x20;   libelle

)



UTILISATEUR(

&#x20;   id\_utilisateur PK,

&#x20;   id\_role FK -> ROLE(id\_role),

&#x20;   nom,

&#x20;   prenom,

&#x20;   email UQ,

&#x20;   telephone UQ,

&#x20;   mot\_de\_passe,

&#x20;   statut

)



ETUDIANT(

&#x20;   id\_utilisateur PK, FK -> UTILISATEUR(id\_utilisateur),

&#x20;   matricule UQ,

&#x20;   niveau,

&#x20;   specialite,

&#x20;   departement,

&#x20;   filiere

)



ENCADRANT(

&#x20;   id\_utilisateur PK, FK -> UTILISATEUR(id\_utilisateur),

&#x20;   grade,

&#x20;   specialite,

&#x20;   departement

)



ADMINISTRATEUR(

&#x20;   id\_utilisateur PK, FK -> UTILISATEUR(id\_utilisateur),

&#x20;   departement

)



ENTREPRISE(

&#x20;   id\_entreprise PK,

&#x20;   raison\_sociale,

&#x20;   secteur\_activite,

&#x20;   adresse,

&#x20;   email,

&#x20;   telephone,

&#x20;   ville,

&#x20;   pays

)



TUTEUR(

&#x20;   id\_utilisateur PK, FK -> UTILISATEUR(id\_utilisateur),

&#x20;   id\_entreprise FK -> ENTREPRISE(id\_entreprise),

&#x20;   fonction

)





Explication : les quatre profils partagent les informations générales stockées dans UTILISATEUR. Leurs tables spécialisées ne contiennent que leurs informations propres.



B. Gestion des demandes de partenariat et des offres



Cette partie permet de gérer les échanges entre l'établissement et les entreprises, la publication des offres et les candidatures des étudiants.



DEMANDE\_PARTENAIRE(

&#x20;   id\_demande PK,

&#x20;   id\_entreprise FK -> ENTREPRISE(id\_entreprise),

&#x20;   id\_auteur FK -> UTILISATEUR(id\_utilisateur),

&#x20;   type\_demande,

&#x20;   objet,

&#x20;   description,

&#x20;   nombre\_stagiaires,

&#x20;   statut,

&#x20;   date\_demande

)



OFFRE\_STAGE(

&#x20;   id\_offre PK,

&#x20;   id\_demande FK -> DEMANDE\_PARTENAIRE(id\_demande),

&#x20;   titre,

&#x20;   description,

&#x20;   specialite\_recherche,

&#x20;   nombre\_places,

&#x20;   date\_publication,

&#x20;   date\_limite,

&#x20;   date\_debut,

&#x20;   date\_fin,

&#x20;   statut

)



CANDIDATURE(

&#x20;   id\_candidature PK,

&#x20;   id\_etudiant FK -> ETUDIANT(id\_utilisateur),

&#x20;   id\_offre FK -> OFFRE\_STAGE(id\_offre),

&#x20;   date\_candidature,

&#x20;   motivation,

&#x20;   statut

)





Explication :

\- DEMANDE\_PARTENAIRE gère les demandes entre l'école et les entreprises.

\- type\_demande distingue ECOLE\_VERS\_ENTREPRISE et ENTREPRISE\_VERS\_ECOLE.

\- Une demande acceptée peut générer plusieurs offres.

\- Une candidature relie un étudiant à une offre.







C. Gestion des demandes de convention et des stages



Cette partie gère les demandes individuelles de convention, la création des stages, les conventions et l'affectation des encadrants.



DEMANDE\_CONVENTION(

&#x20;   id\_demande\_convention PK,

&#x20;   id\_entreprise FK -> ENTREPRISE(id\_entreprise),

&#x20;   id\_etudiant FK -> ETUDIANT(id\_utilisateur),

&#x20;   id\_administrateur FK -> ADMINISTRATEUR(id\_utilisateur),

&#x20;   date\_soumission,

&#x20;   sujet\_stage,

&#x20;   date\_debut,

&#x20;   date\_fin,

&#x20;   statut,

&#x20;   motif\_refus

)



STAGE(

&#x20;   id\_stage PK,

&#x20;   id\_tuteur FK -> TUTEUR(id\_utilisateur),

&#x20;   id\_entreprise FK -> ENTREPRISE(id\_entreprise),

&#x20;   id\_etudiant FK -> ETUDIANT(id\_utilisateur),

&#x20;   id\_demande\_convention FK -> DEMANDE\_CONVENTION(id\_demande\_convention),

&#x20;   id\_candidature FK -> CANDIDATURE(id\_candidature),

&#x20;   sujet,

&#x20;   description,

&#x20;   date\_debut,

&#x20;   date\_fin,

&#x20;   statut

)



CONVENTION(

&#x20;   id\_convention PK,

&#x20;   id\_entreprise FK -> ENTREPRISE(id\_entreprise),

&#x20;   id\_stage FK -> STAGE(id\_stage),

&#x20;   numero,

&#x20;   date\_creation,

&#x20;   date\_signature,

&#x20;   chemin\_pdf,

&#x20;   statut

)



AFFECTATION(

&#x20;   id\_affectation PK,

&#x20;   id\_encadrant FK -> ENCADRANT(id\_utilisateur),

&#x20;   id\_stage FK -> STAGE(id\_stage),

&#x20;   date\_affectation,

&#x20;   date\_fin,

&#x20;   statut

)



Fonctionnement :

\- Un étudiant qui trouve lui-même une entreprise soumet une DEMANDE\_CONVENTION.

\- Une candidature acceptée peut également conduire à la création d'un stage.

\- Le stage est rattaché à une entreprise, un étudiant et éventuellement un tuteur professionnel.

\- Une convention est établie pour le stage.

\- Un encadrant pédagogique est affecté au stage grâce à AFFECTATION.



D. Gestion du suivi pédagogique et de l'évaluation



Cette dernière partie gère les étapes du stage, les documents, les visites, les soutenances, les évaluations et les notifications.



JALON(

&#x20;   id\_jalon PK,

&#x20;   id\_stage FK -> STAGE(id\_stage),

&#x20;   libelle,

&#x20;   description,

&#x20;   date\_limite,

&#x20;   date\_realisation,

&#x20;   statut

)



SOUTENANCE(

&#x20;   id\_soutenance PK,

&#x20;   id\_stage FK -> STAGE(id\_stage),

&#x20;   date\_soutenance,

&#x20;   heure,

&#x20;   salle,

&#x20;   statut

)



VISITE(

&#x20;   id\_visite PK,

&#x20;   id\_stage FK -> STAGE(id\_stage),

&#x20;   id\_utilisateur FK -> UTILISATEUR(id\_utilisateur),

&#x20;   date\_visite,

&#x20;   mode\_visite,

&#x20;   compte\_rendu,

&#x20;   statut

)



EVALUATION(

&#x20;   id\_evaluation PK,

&#x20;   id\_soutenance FK -> SOUTENANCE(id\_soutenance),

&#x20;   id\_utilisateur FK -> UTILISATEUR(id\_utilisateur),

&#x20;   note,

&#x20;   appreciation,

&#x20;   date\_evaluation

)



DOCUMENT(

&#x20;   id\_document PK,

&#x20;   id\_stage FK -> STAGE(id\_stage),

&#x20;   id\_jalon FK -> JALON(id\_jalon),

&#x20;   id\_deposant FK -> UTILISATEUR(id\_utilisateur),

&#x20;   id\_valideur FK -> UTILISATEUR(id\_utilisateur),

&#x20;   nom\_fichier,

&#x20;   chemin\_fichier,

&#x20;   type\_document,

&#x20;   date\_depot,

&#x20;   statut\_validation,

&#x20;   date\_validation

)



NOTIFICATION(

&#x20;   id\_notification PK,

&#x20;   id\_utilisateur FK -> UTILISATEUR(id\_utilisateur),

&#x20;   titre,

&#x20;   message,

&#x20;   date\_envoi,

&#x20;   statut\_lecture

)





Fonctionnement :

\- JALON permet de suivre les différentes étapes du stage.

\- DOCUMENT permet le dépôt et la validation des fichiers.

\- VISITE permet à l'encadrant de réaliser le suivi pédagogique.

\- SOUTENANCE permet de programmer la présentation finale.

\- EVALUATION permet d'enregistrer les notes et appréciations.

\- NOTIFICATION permet d'informer les utilisateurs des événements importants.



Les contraintes d'intégrité à ne pas oublier:



Règle								Contrainte recommandée

Une demande de convention refusée ne crée pas de stage		Vérification du statut avant création

Un stage possède une seule origine				Une seule des deux clés d'origine renseignée

Une demande de convention ne crée qu'un stage			UNIQUE(id\_demande\_convention)

Une candidature ne crée qu'un stage				UNIQUE(id\_candidature)

Une convention appartient à un seul stage			UNIQUE(id\_stage)

Un stage n'a qu'un encadrant actif				Vérification de l'affectation active

Une date de fin doit être postérieure à la date de début	Contrainte CHECK

Une note respecte le barème retenu				Contrainte CHECK



Pour la provenance du stage, la règle est :





ALTER TABLE STAGE

ADD CONSTRAINT chk\_origine\_stage

CHECK (

&#x20;   (

&#x20;       id\_demande\_convention IS NOT NULL

&#x20;       AND id\_candidature IS NULL

&#x20;   )

&#x20;   OR

&#x20;   (

&#x20;       id\_demande\_convention IS NULL

&#x20;       AND id\_candidature IS NOT NULL

&#x20;   )

);







\--Utilisateurs et profils



7 tables



ROLE, UTILISATEUR, ETUDIANT, ENCADRANT, ADMINISTRATEUR, ENTREPRISE, TUTEUR.



\--Partenariats et offres



3 tables



DEMANDE\_PARTENAIRE, OFFRE\_STAGE, CANDIDATURE.



\--Conventions et stages



4 tables



DEMANDE\_CONVENTION, STAGE, CONVENTION, AFFECTATION.



**--Suivi et évaluation**



6 tables



JALON, SOUTENANCE, VISITE, EVALUATION, DOCUMENT, NOTIFICATION.



