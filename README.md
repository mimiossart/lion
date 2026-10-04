# Lion Dynasty Agency V3

Version V3 du portail extranet Lion Dynasty Agency.

## Ce qui est corrigé

- Authentification par code agence.
- Comptes Admin / Manager / Créateur.
- Codes agence créés uniquement par l'Admin.
- Génération et régénération de codes.
- Activation / désactivation des comptes.
- PostgreSQL persistant.
- Sessions stockées dans PostgreSQL via connect-pg-simple.
- Compatible avec Render.
- Route `/health` pour vérifier le service.
- Compatible Express 5 avec fallback SPA sécurisé.

## Comptes de démonstration après la première initialisation PostgreSQL

- Admin : `ADMIN-001`
- Créateur : `LDA-DEMO-101`
- Manager : `LDA-DEMO-202`

Après la première connexion, il est recommandé de créer de nouveaux comptes et de ne pas distribuer les comptes de démonstration.

## Déploiement Render

1. Créer une base PostgreSQL dans Render.
2. Créer ou modifier le Web Service Node.
3. Connecter la base PostgreSQL au Web Service afin que `DATABASE_URL` soit disponible.
4. Variables d'environnement :
   - `DATABASE_URL` : fournie par Render
   - `SESSION_SECRET` : une longue valeur aléatoire secrète
   - `NODE_ENV` : `production`
5. Build Command : `npm install`
6. Start Command : `npm start`
7. Déployer.
8. Tester `/health`, puis la page d'accueil.

## Important

La base PostgreSQL doit être persistante. Ne pas revenir à SQLite pour la production.

Pour une vraie mise en production, il faudra encore ajouter : rate limiting, 2FA, journal d'audit, sauvegardes, gestion des fichiers, permissions plus fines, et les modules métier complets.
