# Plan — Connexion unique sécurisée

## Context
- La connexion membre accepte actuellement un email seul, sans preuve de possession (`AuthService.loginMember`).
- La connexion admin vérifie un mot de passe bcrypt et le flag `member.admin` ; l'interface présente deux onglets.
- Objectif : une seule connexion par collectif, sécurisée, avec droits déterminés côté serveur.
- Décisions confirmées : email + mot de passe, service email à créer, superadmin distinct inchangé, mots de passe des admins existants conservés.
- Découvertes : middleware JWT purement stateless (24 h) ; édition membre par blacklist et secrets partiellement filtrés ; aucun transport SMTP identifié. Il faut empêcher l'injection des nouveaux champs sensibles et invalider les anciennes sessions email-seul.

## Approach
- Email + mot de passe pour tous, lien reçu par email pour définir le premier mot de passe ou le réinitialiser.
- Aucun choix du rôle à la connexion ; conserver les autorisations membre/admin.
- Liens aléatoires, temporaires et à usage unique, secrets stockés sous forme hachée ; réponses neutres et limitation des tentatives/envois.
- Transport SMTP à créer (Nodemailer), configuré globalement via variables d'environnement : hôte, port, TLS, identifiants, expéditeur et URL publique HTTPS. Aucun serveur de messagerie à héberger dans l'application ; relais externe à configurer au déploiement.
- Stocker mots de passe et jetons dans une collection interne `auth-state`, hors CRUD, logs et corbeille, sur le modèle du stockage privé des notifications. Migrer les hashes `adminPassword` existants sans changer les mots de passe.
- Réutiliser les écritures atomiques JSON ; ajouter une mutation atomique lecture-vérification-écriture pour garantir l'usage unique sous requêtes concurrentes (déploiement mono-processus existant).
- JWT des collectifs versionnés et validés contre l'état actuel du compte : refuser les anciens JWT, invalider après réinitialisation, suppression et changement de droits. Superadmin inchangé.
- Décisions confirmées : membres existants via « Définir / mot de passe oublié », sans campagne d'emails ; nouveaux inscrits via envoi automatique ; nouvelle adresse confirmée par email avant remplacement.

### Parcours et protections
- `POST /auth/login/collective` : collectif + email normalisé (trim/minuscules) + mot de passe. Rôle issu du membre actuel ; erreur générique, comparaison bcrypt factice si compte absent. Supprimer les anciens endpoints membre/admin (réponse explicite 410, sans repli SPA).
- `POST /auth/password/request` et `/auth/password/confirm` : activation/réinitialisation commune. Lien de 30 minutes lié au collectif, membre et usage ; un nouvel envoi remplace le précédent. Le GET ne consomme rien (robots email). Consommer le jeton et changer le hash/version de session dans une seule mutation atomique.
- Nouveaux mots de passe : au moins 12 caractères, maximum 72 octets UTF-8 pour éviter la troncature bcrypt ; pas de règles arbitraires de composition. Conserver la vérification des anciens hashes sans leur imposer rétroactivement la nouvelle règle.
- URL construite depuis `PUBLIC_APP_URL`, jamais depuis Host. Jeton dans le fragment du lien, supprimé de l'URL dès lecture côté client ; pas de stockage persistant ni de journalisation. Page de confirmation accessible même avec une session active ; retour à la connexion après succès, sans connexion automatique.
- Limites initiales : connexion 10 essais/15 min par collectif+email et 50/IP ; demandes email 3/h par collectif+email et 20/h/IP ; confirmations 30/15 min/IP. Réponse neutre identique pour compte absent ou quota par email atteint ; 429 sur quota IP. Bornes de taille/types avant bcrypt, quotas mémoire avec nettoyage ; configuration proxy explicite. Couvrir également inscription et vérification de son code partagé.
- SMTP via Nodemailer, TLS vérifié, timeout, expéditeur fixe, modèles texte/HTML FR/EN échappés. Pas de secrets ni d'URL complète dans les logs ; erreur d'envoi visible dans les diagnostics serveur sans révéler l'existence du compte au demandeur. En cas d'échec après inscription, conserver la fiche et permettre un renvoi via la demande de lien.
- Pour les fiches créées par un admin, proposer l'envoi du lien après création et un bouton de renvoi limité ; retirer la saisie du mot de passe admin dans la fiche. Le flag admin reste indépendant du mot de passe.

### Email et cycle de vie
- Email unique par collectif, pas globalement. Contrôler les doublons à la création, à la demande de changement et à sa confirmation, y compris les demandes concurrentes. Ne jamais prendre arbitrairement le premier compte homonyme.
- L'édition de l'email crée une demande en attente ; l'ancien email reste actif jusqu'à confirmation de la nouvelle adresse (lien dédié, 30 minutes). L'utilisateur modifiant son propre email fournit son mot de passe actuel ; un admin autorisé peut initier le changement d'un autre membre sans connaître son mot de passe. Notification à l'ancienne adresse ; invalider sessions et liens précédents à la confirmation.
- Centraliser les mutations d'identité dans le service d'authentification, y compris les changements provenant de la fiche admin. Empêcher toute modification directe des champs d'identité/sécurité via CRUD générique ; listes blanches des champs de profil autorisés.
- L'état privé porte l'identifiant de connexion faisant autorité ; `members.email` en est la projection. Écriture de l'identité et consommation du jeton atomiques dans `auth-state`, puis mise à jour de la fiche, avec réconciliation idempotente au redémarrage en cas d'interruption. Sérialiser créations/changements par collectif pour l'unicité.
- Suppression : révoquer l'état d'authentification et les liens avant suppression de la fiche. Restauration : vérifier les doublons et imposer une nouvelle activation ; ne pas réactiver les anciennes sessions/jetons. Un changement de rôle invalide les sessions précédentes.

### Migration et déploiement
- Migration idempotente avant ouverture du serveur : inventaire des emails invalides/doublons, blocage des comptes ambigus avec rapport sans secrets (autres comptes utilisables). Copier les hashes bcrypt admin vers `auth-state`, vérifier la persistance, puis retirer `adminPassword` des fiches. Les membres sans hash doivent activer leur accès par email.
- Nettoyer/filtrer aussi les anciens secrets des logs et de la corbeille ; aucune restauration ne réintroduit un hash historique. Protéger `auth-state` des routes génériques, journaux, corbeille et exports.
- Version d'authentification obligatoire dans les JWT des collectifs : toutes les anciennes sessions expirent au déploiement, y compris celles des admins, sans changer leur mot de passe. Conserver la durée actuelle de 24 h et le transport Bearer pour limiter le périmètre ; rôle, existence du compte et version revérifiés à chaque requête. Adapter le middleware asynchrone et ses appels ; superadmin global inchangé.
- Sauvegarde préalable ; configuration SMTP et URL HTTPS requises pour déployer ce parcours en production. Documenter SPF/DKIM/DMARC, test réel de délivrabilité et fonctionnement mono-processus. Pas de serveur mail ni de prestataire imposé dans le code.

## Files to modify
- `src/backend/services/AuthService.js` — connexion, liens, identité, sessions et migration ; nouveaux `AuthStateService.js` et `EmailService.js` dans le même dossier pour persistence privée et SMTP.
- `src/backend/storage/{StorageAdapter,FileSystemAdapter}.js` — primitive de mutation atomique.
- `src/backend/services/{internalCollections,DataService,TrashService,LogService}.js` — protection des identités, cycle de vie et secrets historiques.
- `src/backend/routes/{auth,members,api,trash}.js`, `src/backend/middleware/auth.js` et nouveau `src/backend/middleware/authRateLimit.js` — endpoints, autorisations et quotas.
- `src/backend/server.js` — configuration/injection SMTP, migration avant écoute et vérification asynchrone ; adapter les autres appelants de `verifyToken` si nécessaire.
- `src/frontend/js/views/{LoginView,RegisterView,MembersView}.js` — formulaire unique, messages d'activation, email en attente et invitation.
- Nouveau `src/frontend/js/views/AuthLinkView.js` — définition du mot de passe et confirmation email ; `src/frontend/js/{api,app,i18n}.js` et `src/frontend/index.html` — API, routes publiques et libellés FR/EN.
- `package.json`, `package-lock.json`, `.env.example`, `readme.md` et nouveau `docs/authentication.md` — Nodemailer, configuration et déploiement.
- Nouveaux `test/{authService,authRoutes,authLifecycle,emailService,authViews}.test.js` ; compléter `test/fileSystemConcurrency.test.js` et adapter les doubles de stockage/middleware existants.

## Reuse
- `AuthService.hashPassword` et vérification bcrypt dans `src/backend/services/AuthService.js`.
- Stockage des membres via `storage.read` et rôle existant `member.admin`.
- `LoginView.postLoginTarget` pour le retour après connexion.
- `asyncHandler` dans `src/backend/middleware/asyncHandler.js`.
- `src/backend/services/NotificationStateService.js` : modèle de collection privée et jetons `crypto.randomBytes(32)` / SHA-256, sans réutiliser les jetons des notifications.
- `src/backend/services/internalCollections.js` : étendre le garde-fou des collections internes.
- `src/backend/storage/FileSystemAdapter.js` : sérialisation `_mutate` et écriture atomique `_writeAll`.
- `src/backend/services/LogService.js` : masquage récursif des secrets à compléter ; vérifier aussi les sorties corbeille et CRUD générique.

## Steps
- [x] Ajouter l'état privé et la mutation atomique ; tests de concurrence et blocage du CRUD générique.
- [x] Implémenter la migration idempotente et le contrôle des identités ; nettoyer les secrets historiques.
- [x] Ajouter SMTP injectable, liens temporaires, quotas et parcours de confirmation.
- [x] Unifier la connexion et rendre la validation des sessions révocable ; retirer l'accès email-seul.
- [x] Brancher création, changement d'email, rôle, suppression/restauration sur les contrôles d'identité.
- [x] Adapter les écrans FR/EN et le routeur sans changer le parcours superadmin.
- [ ] Exécuter tests, vérifier les parcours en SMTP de test puis réel, documenter migration et exploitation.
  - Fait : **84 tests réussis**, contrôles de syntaxe JS et `git diff --check`, parcours HTTP, formulaires VM, SMTP local de capture avec Nodemailer ; documentation `docs/authentication.md` et `.env.example`.
  - Bloqué : SMTP réel et vérification navigateur de déploiement. `SMTP_HOST`, `SMTP_FROM` et `PUBLIC_APP_URL` absents de l'environnement actuel ; aucun email externe envoyé, aucune migration des données réelles exécutée.
  - Audit : 8 vulnérabilités préexistantes hors Nodemailer, documentées ; pas de mise à niveau générale ou incompatible des dépendances.

### Notes d'implémentation
- Les projections de création/restauration et de modification de fiche sont aussi journalisées dans l'état privé pour permettre leur reprise après erreur disque.
- Les champs Home Assistant historiques restent utilisables ; seules les données d'authentification sont retirées des fiches.
- Le code d'inscription n'est plus exposé publiquement, mais reste accessible au superadmin.
- Les quotas IP restent mono-processus ; un quota persistant partagé de 3 demandes email/h/compte complète les limites des routes.
- Les tests sont répartis dans `test/auth*.test.js` et `test/emailService.test.js` ; aucun test n'utilise les données de production.

## Verification
- Connexion membre et admin via le même formulaire, droits inchangés.
- L'email seul ne permet plus de se connecter, y compris via les anciens endpoints.
- Définition et réinitialisation : lien expiré, réutilisé, invalide ou pour un autre collectif refusé.
- Réponses ne révélant pas l'existence d'un compte ; tentatives et envois limités.
- `npm test` : stockage temporaire, horloge/transport email injectés, aucun email réel ni lecture/écriture des données de production.
- Deux confirmations simultanées du même jeton : un seul succès ; demandes concurrentes pour une même adresse : une seule identité. Redémarrage entre écriture privée et projection : réconciliation correcte.
- Migration rejouée sans perte ; ancien mot de passe admin toujours valide ; ancien JWT membre/admin refusé ; superadmin inchangé. Compte supprimé/restauré ou rétrogradé : sessions et liens précédents refusés.
- Emails inconnus et comptes sans mot de passe : mêmes réponses publiques ; panne SMTP, types invalides, longs mots de passe, quotas et mauvais collectif testés.
- Aucune injection de rôle/hash/jeton via fiche ou CRUD ; absence de secrets dans réponses, logs et corbeille. Changements d'email non confirmés sans effet sur la connexion ; confirmations expirées, doublons et réutilisations refusés.
- Tests frontend : formulaire unique, confirmation accessible connecté/déconnecté, suppression du fragment, états d'attente/erreur/succès, retour après connexion et traductions FR/EN.
- Manuel avec capture SMTP locale puis boîte réelle : première activation d'un ancien membre, connexion admin avec ancien mot de passe, nouvel inscrit, invitation admin, oubli, changement email et reconnexion obligatoire. Vérifier HTTPS, délivrabilité et absence de jetons dans les logs serveur/proxy.
