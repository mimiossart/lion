# Lion Dynasty Agency V8

Evolution de l'extranet avec contrôle d'accès par catégories.

## Changements V8
- Fondateur et Co-Fondateur exemptés du verrouillage d'inactivité de 72 h.
- Suppression de l'affichage des rubriques LIVE TikTok, Challenges, Notre équipe, Jeux et Collaborations.
- Messagerie avec conversations et rafraîchissement en direct par polling.
- Réactivation des accès robuste pour tous les rôles sauf Créateur.
- Matchs : sélection d'un créateur inscrit, +18 / -18 / Tous, avec ou sans boost.
- Match posters : upload d'image jusqu'à 1 000 000 000 octets et association à un créateur.
- Administration : autorisation de catégories par utilisateur.
- Les accès sont contrôlés côté serveur pour les catégories principales.


### Correctifs V8
- Chat en direct via WebSocket, avec rafraîchissement de secours toutes les 10 secondes.
- Création de comptes immédiatement visible dans Administration.
- Modification du nom/rôle des comptes avec contrôle de hiérarchie côté serveur.
- Suppression sécurisée des comptes et des créateurs, avec nettoyage des données liées.
- Les Managers peuvent supprimer uniquement leurs propres créateurs.
- Fondateur et Co-Fondateur restent toujours exempts du verrouillage d'inactivité 72 h.
- Les créateurs restent soumis au délai de 72 h et voient une fenêtre « Connexion refusée » en cas de blocage.
- Matchs sans titre saisi manuellement : le créateur inscrit est la référence du match.
- Contrôle d'accès par catégories maintenu côté serveur.

### Déploiement
Conserver `DATABASE_URL`, `SESSION_SECRET` et `NODE_ENV=production` dans Render.
Le dossier `uploads/` sert au stockage temporaire des posters. Pour une conservation permanente de fichiers jusqu'à 1 Go, utiliser ensuite un stockage objet (S3/R2/équivalent) plutôt que le disque éphémère du service web.
