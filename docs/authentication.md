# Connexion unique et emails d'authentification

## Parcours

- `/<collectif>/login` : email + mot de passe, rôle membre/admin choisi par le serveur, sans onglets.
- Membres existants sans mot de passe : **Définir / mot de passe oublié**, sans campagne d'envoi automatique.
- Inscription protégée par le code partagé du collectif : création sans droits admin puis envoi d'un lien. Une demande sur un email existant ne modifie jamais sa fiche.
- Création par un admin : proposition d'envoi après création ; bouton de renvoi sur la fiche. Import XLSX : activation à demander depuis la connexion (pas de campagne automatique).
- Changement d'email : l'ancienne adresse reste active ; confirmer la nouvelle via le lien reçu. Pour modifier sa propre adresse, fournir le mot de passe actuel. Un admin peut initier le changement d'un autre membre ; la confirmation reste obligatoire. L'ancienne adresse reçoit un avis.
- `/login` reste réservé au superadmin global, avec son mot de passe d'environnement.

Les liens expirent après **30 minutes**, ne servent qu'une fois et sont liés à un collectif, un compte et un usage. Un nouvel envoi pour le même usage invalide le précédent. Seul un POST de confirmation consomme le lien : les robots qui ouvrent les emails ne le consomment pas. Mot de passe et changement d'adresse invalident les sessions et les autres liens du compte ; la confirmation ne connecte pas automatiquement.

Les nouveaux mots de passe font au moins **12 caractères** et au plus **72 octets UTF-8**, limite de bcrypt. Les mots de passe historiques des admins restent valables sans changement (hors hash historique invalide, qui nécessite une réinitialisation).

## Déploiement

**Avant le premier démarrage de cette version :**

1. Arrêter l'ancienne instance, sauvegarder `data/` et les collectifs, protéger cette sauvegarde (elle contient des secrets historiques). Ne pas lancer l'ancienne version après migration : elle réintroduirait l'accès email-seul.
2. Utiliser Node **20 ou supérieur** et installer les dépendances du lockfile (`npm ci`).
3. Configurer `.env` d'après `.env.example` : `SUPERADMIN_PASSWORD`, `JWT_SECRET`, `SUPERADMIN_EMAIL`, puis SMTP et l'URL publique.
4. Choisir un relais SMTP externe (hébergeur ou prestataire), avec un expéditeur autorisé. Configurer SPF, DKIM et DMARC pour son domaine.
5. Mettre `NODE_ENV=production`. Dans ce mode, l'application refuse de démarrer sans transport SMTP configuré, expéditeur et URL HTTPS. Ce contrôle de présence ne remplace pas un test des identifiants/délivrabilité.
6. Démarrer **une seule instance/processus Node** avec `node src/backend/server.js`. La migration s'exécute avant l'ouverture du serveur.

Configuration :

| Variable | Usage |
| --- | --- |
| `PUBLIC_APP_URL` | Origine publique, ex. `https://collectifs.example.org`, sans chemin, paramètres ni fragment. Jamais déduite du header Host. |
| `SMTP_HOST`, `SMTP_PORT` | Relais, port 587 par défaut. |
| `SMTP_SECURE` | `false` sur 587 : STARTTLS obligatoire ; `true` sur 465 : TLS direct. Certificats toujours vérifiés. |
| `SMTP_USER`, `SMTP_PASSWORD` | Identifiants du relais ; facultatifs uniquement pour un relais explicitement autorisé sans authentification. |
| `SMTP_FROM` | Expéditeur autorisé, ex. `Feddeeji <noreply@example.org>`. |
| `TRUST_PROXY` | Liste explicite des adresses/sous-réseaux des proxies de confiance. Vide si accès direct. Ne pas mettre `true` ni un nombre de sauts générique. |

L'application ne fournit ni serveur mail ni compte chez un prestataire. Aucun mot de passe, contenu SMTP ou lien brut n'est journalisé. En cas de panne SMTP, le serveur produit un diagnostic générique et la demande publique reste neutre. La fiche est conservée ; redemander un lien après correction (et expiration du quota si nécessaire). Les envois sont asynchrones, sans file durable : un arrêt juste après la demande peut nécessiter un renvoi.

## Migration et exploitation

- Hashes bcrypt historiques déplacés dans `data/<collectif>/auth-state.json`, sans connaître ni changer les mots de passe. `adminPassword` supprimé des fiches, logs et corbeille. Les réglages Home Assistant existants sont conservés.
- Emails normalisés en minuscules, espaces périphériques supprimés. Un email doit être unique **dans un collectif** ; le même email peut exister dans deux collectifs.
- Comptes avec email invalide/ambigu bloqués et signalés au démarrage par identifiant (sans secret) ; les autres restent utilisables. Un superadmin peut corriger ces comptes via une demande de changement d'adresse confirmée. Ne pas fusionner automatiquement des identités.
- Migration idempotente. L'état privé conserve les projections de fiches non terminées ; un redémarrage répare une interruption entre persistance de l'identité et écriture du profil.
- Tous les anciens JWT membre/admin sont refusés dès ce déploiement ; les utilisateurs se reconnectent. Les JWT superadmin restent inchangés. Nouveaux JWT : 24 h, version et rôle recontrôlés côté serveur à chaque requête.
- Réinitialisation, confirmation email, changement de rôle et suppression révoquent les anciennes sessions. La suppression révoque avant mise à la corbeille ; en cas d'erreur disque, le compte reste bloqué et la suppression est à réessayer après correction.
- Restauration d'un membre : vérifier l'unicité de son email ; aucune restauration de son ancien hash ou de ses liens. Définir un nouveau mot de passe via email.
- Ne jamais éditer directement `members.email` : l'identité privée fait autorité. Sauvegarder les fichiers ensemble, application arrêtée. Les écritures atomiques et verrous sont **mono-processus**, pas compatibles cluster/plusieurs instances. Un autre backend devra fournir les mêmes garanties transactionnelles.

## Protections et limites

- Collection `auth-state` inaccessible au CRUD générique (y compris casse différente), aux logs et à la corbeille. Mots de passe bcrypt, jetons aléatoires de 32 octets dont seul le SHA-256 est stocké. Jeton de confirmation et hash du nouveau mot de passe modifiés atomiquement.
- Modifications de profil par liste blanche ; aucun champ arbitraire de hash, rôle ou version autorisé à un membre. Le code d'inscription n'est plus exposé par la liste publique des collectifs.
- Réponses publiques neutres pour demande de lien, quota d'email atteint et email inconnu ; échecs de connexion génériques avec comparaison bcrypt factice pour un compte absent.
- Connexion : 10 essais/15 min par collectif+email, 50/IP. Superadmin : 10/15 min/IP. Demande de lien : 3/h par collectif+email et 20/h/IP. Confirmation : 30/15 min/IP. Vérification du code d'inscription : 30/15 min/IP ; inscription : 20/h/IP et 3/h/email. Édition/invitation : 50/h/IP.
- Quota persistant supplémentaire : **3 demandes email/h/compte**, commun aux liens de mot de passe et de changement d'adresse, y compris invitations. Les compteurs IP, bornés en mémoire, repartent au redémarrage ; une protection anti-abus au proxy reste recommandée.
- Jeton placé dans le fragment de l'URL (pas envoyé au serveur HTTP), retiré dès prise en charge de la route et conservé uniquement en mémoire du tab. Les changements de langue le conservent, pas le rechargement complet : rouvrir alors le lien de l'email. Pas de connexion automatique ; pas de token de lien dans le localStorage. Politique Referrer `no-referrer`.
- Le JWT de session utilise toujours le Bearer/localStorage existant. Cette évolution ne remplace pas une protection XSS globale, une MFA ou un audit complet de l'application. Huit vulnérabilités de dépendances ont été signalées par `npm audit` lors de l'implémentation (hors Nodemailer) ; les mises à niveau, notamment ExcelJS/uuid, restent un chantier distinct.

## Endpoints

- `POST /auth/login/collective` : `{ collectiveId, email, password }`.
- `POST /auth/password/request` : `{ collectiveId, email, lang? }`.
- `POST /auth/password/confirm` : `{ collectiveId, token, password }`.
- `POST /auth/email/confirm` : `{ collectiveId, token }`.
- Modification de l'email via les routes de fiche habituelles : `email`, `currentPassword` si soi-même, `lang?`. Réponse avec `pendingEmail`, sans modifier l'adresse actuelle.
- `POST /api/:collectiveId/members/:id/invite` : admin, `{ lang? }`.
- `/auth/login/member` et `/auth/login/admin` : **410**, aucune compatibilité email-seul.

## Vérification

`npm test` utilise des dossiers temporaires, une horloge injectable, des transports simulés et un serveur SMTP de capture sur loopback. Les tests ne démarrent pas `server.js`, ne migrent pas les données réelles et n'envoient aucun email externe.

Tests couverts : migration rejouable/récupération après panne, unicité concurrente, usages/expiration des liens, rôles, ancien JWT, réinitialisation, confirmation email, suppression/restauration, injection de champs, routes HTTP, absence de secrets d'authentification dans les réponses, quotas, MIME SMTP et formulaires FR/EN.

**À réaliser sur l'environnement de déploiement (nécessite SMTP réel) :**

- [ ] Ouvrir l'application en HTTPS ; activer un ancien membre depuis sa boîte réelle.
- [ ] Se connecter comme admin avec son ancien mot de passe et vérifier les droits ; vérifier le superadmin séparé.
- [ ] Inscription et invitation depuis une fiche : bonne réception, expéditeur, indésirables et rendu mobile.
- [ ] Réinitialiser le mot de passe ; ancienne session refusée, lien réutilisé/expiré refusé.
- [ ] Changer son email puis le confirmer ; ancien email conservé avant confirmation, nouvelle connexion ensuite ; avis reçu par l'ancienne adresse.
- [ ] Vérifier l'absence de jetons dans les logs HTTP/proxy et la configuration des IP de confiance.

L'envoi externe et ces vérifications navigateur ne sont pas certifiés par les tests automatisés.
