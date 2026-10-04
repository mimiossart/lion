# Lion Dynasty Agency — V2

Application web serveur avec :
- connexion par code agence ;
- codes attribués uniquement par Admin ;
- base SQLite ;
- sessions serveur ;
- rôles Admin / Manager / Créateur ;
- activation/désactivation ;
- régénération des codes ;
- tableau de bord ;
- PWA installable (manifest inclus).

## Démarrage local
1. Installer Node.js 20+.
2. `npm install`
3. `npm start`
4. Ouvrir http://localhost:3000

Comptes de démonstration :
- ADMIN-001
- LDA-DEMO-101
- LDA-DEMO-202

## Mise en production
Définir une vraie SESSION_SECRET, utiliser HTTPS, et conserver la base de données sur un stockage persistant. Le projet est prêt à être déployé sur un hébergeur Node.js.
