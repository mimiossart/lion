# Lion Dynasty Agency V9.4

Correction ciblée : les identifiants PostgreSQL BIGINT sont renvoyés comme chaînes par `pg`. L'interface comparait parfois un ID numérique avec une chaîne, ce qui provoquait « Créateur introuvable » alors que le compte existait bien. Les recherches de créateurs/utilisateurs côté interface comparent désormais les identifiants de manière sûre.

Cette version conserve les fonctions de V9.3 et la base PostgreSQL existante.
