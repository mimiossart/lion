# Lion Dynasty Agency — V9.1

Portail agence Node.js + Express + PostgreSQL + PWA.

## Correction importante V9.1 — profils créateurs

Chaque compte utilisateur créé dans **Administration**, quel que soit son rôle de connexion (Fondateur, Co-Fondateur, Directeur, Manager, Créateur, etc.), possède automatiquement un **profil dans l'espace Créateurs**.

Le même compte peut donc être sélectionné dans :
- Créateurs
- Classement
- Matchs officiels
- Match posters
- Statistiques TikTok
- Contrats

Le rôle de connexion reste indépendant et continue de contrôler les droits et catégories accessibles.

Les listes de créateurs sont filtrées par portée hiérarchique pour les managers/comptes créateurs, tandis que la direction peut voir tous les comptes.

## Variables Render

- `DATABASE_URL` = Internal Database URL de PostgreSQL Render
- `SESSION_SECRET` = secret long et aléatoire
- `NODE_ENV=production`
- `PORT` fourni par Render

Ne jamais publier les secrets dans GitHub ou dans des captures d'écran.

## Démarrage

```bash
npm install
npm start
```


### Comptes de démonstration
Cette version ne crée plus aucun compte de démonstration. Les anciens codes `ADMIN-001`, `LDA-DEMO-101` et `LDA-DEMO-202` sont automatiquement supprimés au démarrage s’ils existent encore dans la base. Les vrais comptes existants sont conservés.

## V9.3
Tous les comptes utilisateurs actifs sont également visibles dans la rubrique Créateurs et dans les sélecteurs de créateur. Les actions Modifier/Supprimer depuis Créateurs s'appliquent au compte concerné (sauf suppression de son propre compte).
