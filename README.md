# Lion Dynasty Agency V6.4

V6.4 is a production-oriented Node.js/Express/PostgreSQL agency extranet built on the stable V5 role system.

## Roles
- Fondateur: full access
- Co-Fondateur: near-full management
- Directeur: agency management
- Manager: manages assigned creators
- Ambassadeur: ambassador workspace
- Créateur: personal workspace

## Functional modules
Creators and ranking, TikTok daily stats, contracts, documents, internal messages, official matches, challenges, requests, notifications, audit/security, and reusable agency modules.

## Existing database
V6.4 migrates the existing PostgreSQL schema in place. It does not delete users or existing module data. Keep the same `DATABASE_URL` and `SESSION_SECRET` used by the current Render service.

## Demo codes only for a brand-new empty database
- ADMIN-001 -> Fondateur
- LDA-DEMO-101 -> Créateur
- LDA-DEMO-202 -> Manager

For production, regenerate/replace demo credentials.


## V6.4.3
- Le Fondateur peut créer/attribuer le rôle Fondateur depuis l’administration.
- Les autres rôles ne peuvent jamais créer un compte Fondateur.


## V6.4 — gestion complète des créateurs
- Modification des créateurs pour Fondateur, Co-Fondateur, Directeur et Manager (Manager = son équipe).
- Suppression des créateurs pour Fondateur, Co-Fondateur et Directeur.
- Confirmation avant suppression.
- Les statistiques TikTok et contrats liés sont supprimés automatiquement avec le créateur.
