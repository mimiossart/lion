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


### Correctif V20
Le lecteur Daily utilise `window.DailyIframe.createFrame(...)`, qui est le nom global fourni par `@daily-co/daily-js`. Le module inclut aussi le bouton plein écran et un message d’erreur plus clair si le script Daily n’est pas chargé.


Correctif V20 : daily-js expose le global `window.Daily` (et non `window.DailyIframe`) pour `Daily.createFrame()`. Ajout d’un cache-busting sur app.js.


### V24 — Jours validés synchronisés
- Ajout du champ « Jours validés » dans le profil/créateur.
- Synchronisation avec Statistiques TikTok.
- Les saisies de statistiques mettent à jour la valeur actuelle du créateur.
- La modification du profil met à jour la dernière statistique disponible sans réinitialiser son verrouillage de 24 h.


### V25 — gestion créateurs
- Suppression de la catégorie « Statistiques TikTok » de l’interface.
- « Jours validés » est géré directement dans la fiche créateur.
- Une modification d’un créateur est verrouillée pendant 24 h après modification.
- Exception : Fondateur et Manager peuvent modifier sans attendre.
- Correction de l’erreur serveur lors de la modification des créateurs.


## V27 — coloriages persistants
Les coloriages sont désormais stockés dans PostgreSQL (BYTEA) afin de survivre aux redéploiements Render. Le module ajoute aussi Agrandir/Télécharger. Pour les très gros fichiers (proches de 1 Go), un stockage objet (S3/R2/Cloudinary) reste recommandé.
