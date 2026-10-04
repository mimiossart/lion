# Lion Dynasty Agency V15 — accès Manager complet

Cette version étend l’accès des Managers à l’ensemble du panneau et des modules de l’agence.

## Droits
- Fondateur : accès complet.
- Co-Fondateur : accès complet.
- Directeur : accès complet.
- Manager : accès complet aux modules, statistiques, créateurs, matchs, posters, documents, demandes et administration.
- Les Managers peuvent gérer les comptes de niveau inférieur, sans pouvoir modifier/supprimer un compte de niveau égal ou supérieur.
- La consultation directe des codes de connexion reste réservée au Fondateur.

## Déploiement
Remplacer les fichiers du dépôt GitHub par le contenu de cette archive puis laisser Render redéployer.


## Lien invitation agence
Une rubrique « Lien invitation agence » est disponible dans le menu et contient le lien TikTok fourni par l’agence.


## Réunions vidéo Daily
Le module « Réunions vidéo » utilise Daily Prebuilt. Il nécessite une clé API Daily stockée uniquement côté serveur.

Variables Render à ajouter :
- `DAILY_API_KEY` = clé API privée du projet Daily

Le navigateur reçoit uniquement un jeton de réunion temporaire généré par le serveur. Les salles sont privées et les rôles Fondateur, Co-Fondateur, Directeur et Manager rejoignent comme propriétaires de salle.

Documentation officielle Daily : https://www.daily.co/products/prebuilt-video-call-app/quickstart/
