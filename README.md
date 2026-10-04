# Lion Dynasty Agency V9.4

Correction ciblée : les identifiants PostgreSQL BIGINT sont renvoyés comme chaînes par `pg`. L'interface comparait parfois un ID numérique avec une chaîne, ce qui provoquait « Créateur introuvable » alors que le compte existait bien. Les recherches de créateurs/utilisateurs côté interface comparent désormais les identifiants de manière sûre.

Cette version conserve les fonctions de V9.3 et la base PostgreSQL existante.


## Codes de connexion — Fondateur
Les codes sont toujours hachés pour l'authentification et une copie chiffrée est conservée uniquement pour permettre au **Fondateur** de consulter les codes depuis Administration. La clé de chiffrement doit rester secrète : définissez `CODE_ENCRYPTION_KEY` dans Render (longue valeur aléatoire). Les comptes créés avant cette fonctionnalité ne peuvent pas être récupérés en clair : le Fondateur doit utiliser **Nouveau code** pour leur attribuer un nouveau code consultable.
