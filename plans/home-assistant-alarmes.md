# Plan — Alarmes téléphoniques via Home Assistant

## Context

Priorité : développer l’intégration Home Assistant pour recevoir des alarmes sur téléphone.

Exigences confirmées :
- alerte insistante répétée toutes les 10 minutes jusqu’à acquittement ;
- acquitter signifie qu’une étape de l’action est faite : l’alerte doit être reliée à la progression réelle, pas simplement à un accusé de lecture ;
- déclencheur prioritaire : une action à faire ;
- téléphones Android et iPhone ; Companion déjà installé sur Android ;
- instance Home Assistant sur NAS Synology, test de notification fonctionnel ;
- destinataires : responsable de l’action ou personnes explicitement choisies, pas de diffusion générale implicite ;
- bouton « Fait » ou « OK » directement dans la notification pour valider l’étape ; privilégier « Fait » pour expliciter qu’il enregistre une réalisation ;
- la validation d’une étape par une personne arrête les rappels de cette étape pour tous ;
- aucune alerte la nuit, avec plage silencieuse paramétrable commune au collectif ;
- une heure est définie lorsqu’une alerte est activée pour une action, avec premier déclenchement le jour prévu (pas au début de `windowDays`) ;
- pour plusieurs étapes, chaque délai est relatif à la validation de l’étape précédente (et non de la première) ;
- URL stable de Feddeeji pour le retour HA : `https://app.feddeeji.com/`.

Prévoir un délai configurable par étape suivant la première et un fuseau horaire explicite par collectif. Le bouton nécessite un retour sécurisé HA → Feddeeji, avec identification de l’étape/occurrence et traitement idempotent des clics concurrents ou tardifs. Prévoir l’installation/configuration Companion sur iPhone et vérifier les capacités réelles par plateforme : une notification répétée ne garantit pas une sonnerie continue ni le contournement du mode silencieux.

### Constats initiaux

- Une intégration webhook existe déjà par membre (`haBaseUrl` + `haWebhookId`, compatibilité `haWebhookUrl`).
- Le scheduler contrôle les actions à échéance/en retard, 30 secondes après démarrage puis toutes les heures. Une action affectée cible son membre ; sinon les membres configurés sont ciblés.
- La déduplication actuelle est en mémoire, par action/occurrence/jour, pas par destinataire ; même un envoi échoué bloque les nouvelles tentatives du jour.
- Le payload contient action, statut, date, collectif et description. La notification téléphone dépend d’une automatisation HA externe.
- Une route de test personnelle et un déclenchement admin existent. Le déclenchement admin parcourt actuellement tous les collectifs.
- Le transport accepte actuellement les certificats TLS non vérifiés : politique à sécuriser sans ignorer les installations locales.
- `DataService` journalise les objets complets et le routeur API expose un CRUD générique : les données techniques sensibles doivent rester hors de ces accès/journaux. Le stockage injecté peut être réutilisé pour une collection interne dédiée.

## Approach

Renforcer le flux existant Feddeeji → webhook Home Assistant → application Companion, plutôt que créer un second canal. Feddeeji reste seul maître du planning, des répétitions et de l’état des étapes ; HA assure la livraison et relaie le bouton « Fait ».

### Configuration et progression

- Ajouter une configuration d’alerte optionnelle par action : activation explicite, heure locale `HH:mm`, responsable ou liste de membres, délais en minutes pour les transitions suivantes, y compris l’état final implicite. Préserver `states` et les actions historiques ; ne pas activer les nouveaux rappels insistants automatiquement.
- Paramètres admin du collectif : fuseau IANA explicite et début/fin de plage silencieuse commune, traversant éventuellement minuit. Demander ces valeurs avant activation plutôt que dépendre du fuseau du NAS.
- Première étape : jour d’occurrence + heure configurée, indépendamment de `windowDays`. Étape suivante : horodatage serveur de validation de la précédente + délai configuré. Une seule étape active par occurrence. Une étape déjà validée dans Feddeeji arrête aussi les rappels.
- Pendant la plage silencieuse, suspendre les envois, pas les validations. À la reprise, envoyer au plus un rappel par alerte encore active, sans rattraper tous les créneaux manqués. Les délais restent du temps écoulé, non des minutes ouvrées.
- Destinataires absents/non configurés : montrer un diagnostic, ne jamais substituer tous les membres.

### Fiabilité et acquittement

- Contrôle toutes les 30 secondes, répétition 10 minutes après le dernier envoi réussi par destinataire. Conserver les tentatives, succès et prochaines échéances dans une collection interne persistante. Réessayer les échecs avec temporisation bornée ; empêcher les exécutions concurrentes du scheduler.
- Relire la progression avant chaque envoi. Identifier chaque alerte par collectif/action/occurrence/étape ; conserver un identifiant stable de notification pour remplacement et effacement sur chaque téléphone.
- Bouton « Fait » : token opaque aléatoire par destinataire/étape, hash stocké côté serveur, périmètre limité, révocable et invalidé dès progression/désactivation. HA renvoie ce token en POST vers une route dédiée à authentification spécifique, sans exposer de JWT utilisateur ni permettre un acquittement GET.
- Extraire une transition de progression commune à l’interface et au callback : vérifier occurrence, étape attendue et destinataire ; écrire un log `done` attribué au membre. Sérialiser les transitions par occurrence dans le processus Node existant ; relire les logs pour neutraliser doublons, redémarrages et anciens boutons. Documenter la limite mono-processus tant que le stockage ne fournit pas de transactions.
- Après validation, arrêter les rappels pour tous et demander l’effacement des notifications correspondantes via HA. Un ancien bouton ne doit jamais valider l’étape suivante. L’effacement sur un téléphone hors ligne reste best effort.

### Intégration HA et sécurité

- Conserver les webhooks par membre actuellement fonctionnels. Versionner le payload en gardant les champs historiques ; ajouter type (`reminder`/`clear`), étape, identifiant stable, bouton et token d’acquittement.
- Fournir des automatisations HA documentées pour réception, notification Android/iOS et retour des événements `mobile_app_notification_action` vers l’URL fixe `https://app.feddeeji.com/`. Vérifier l’association appareil/destinataire côté HA ; ne pas utiliser une URL de callback arbitraire tirée du payload.
- Installer/configurer Companion sur iPhone ; préciser les permissions sonores. Objectif : notifications sonores répétées, pas promesse de sonnerie continue ni de contournement de « Ne pas déranger ».
- Restreindre le déclenchement admin au collectif courant. Exclure la collection interne du CRUD générique ; ne jamais journaliser les tokens ou exposer les secrets webhook aux autres membres.
- Valider HTTP(S), interdire credentials et redirections, borner timeout et réponse ; TLS vérifié par défaut avec exception locale explicite. Conserver l’accès HA privé légitime mais borner les destinations configurables (origine autorisée administrativement) pour éviter un proxy SSRF.
- Afficher séparément « webhook accepté par HA » et « étape acquittée » : un HTTP 2xx ne prouve pas la réception sur téléphone.

## Files to modify

Fichiers existants :
- `src/backend/services/NotificationService.js` — transport webhook.
- `src/backend/services/ActionNotificationScheduler.js` — échéances, ciblage et fiabilité.
- `src/backend/routes/notifications.js` — test et déclenchement sécurisé par collectif.
- `src/backend/routes/actions.js` — validation de la configuration d’alerte et des destinataires.
- `src/backend/routes/actionLogs.js` — progression partagée entre interface et acquittement mobile.
- `src/frontend/js/ActionFormManager.js` et `src/frontend/js/views/ProgrammeView.js` — activation, heure, destinataires et délais par étape.
- `src/frontend/js/views/MembersView.js` — configuration HA existante à examiner.
- `src/frontend/js/api.js`, `src/frontend/js/i18n.js` — API et libellés FR/EN.
- `src/backend/server.js`, `src/backend/routes/api.js` — injection des services, callback avant l’authentification JWT générale, protection des collections internes.
- `src/backend/routes/members.js`, `src/backend/services/LogService.js` — validation de destination et masquage des secrets dans réponses/journaux.
- `src/backend/storage/FileSystemAdapter.js` — sérialiser les mutations par collectif/collection et écrire par fichier temporaire + renommage atomique ; le read-modify-write actuel peut perdre des validations concurrentes, même pour deux actions différentes.
- `src/frontend/js/views/MembersView.js` — ajouter également un panneau admin des paramètres communs d’alerte, en réutilisant cette vue de configuration HA.
- `ARCHITECTURE.md`, `readme.md`, `.env.example` — flux, configuration, limites et lien vers le guide.

Nouveaux fichiers :
- `src/backend/services/ActionProgressService.js` — transitions communes et idempotentes, sérialisation par occurrence.
- `src/backend/services/NotificationStateService.js` — état persistant interne, tokens hashés et paramètres communs du collectif, sans journalisation de secrets.
- `src/backend/routes/notificationCallbacks.js` — callback POST limité, validation stricte et limitation de débit.
- `docs/home-assistant.md` — installation et exemples YAML d’automatisations réception/effacement/retour, Android et iOS ; exemples à valider contre la documentation officielle Companion lors de l’implémentation.
- `test/actionNotifications.test.js`, `test/notificationCallbacks.test.js`, `test/actionProgress.test.js`, `test/notificationRoutes.test.js`, `test/fileSystemConcurrency.test.js` — tests Node avec horloge, stockage et transport contrôlés.

## Reuse

- `NotificationService.send` pour le POST JSON avec timeout.
- `src/frontend/js/ActionOccurrenceResolver.js` : `computeCurrentState` résout la progression par occurrence ; les états vont de 0 à `states.length + 1` (état final implicite). Respecter les logs historiques sans état et inclure l’étape finale dans le paramétrage des délais.
- `ActionFormManager` conserve actuellement les états sous forme de libellés séparés par virgules, sans délais dédiés ; étendre sans casser les actions existantes ni les modèles.
- `ActionNotificationScheduler` : `checkAndNotify`, `_checkCollective`, `_getMembersToNotify`, `_buildWebhookUrl` ; vérifier la cohérence du calcul d’échéance avec le programme avant extension.
- Routes `/notifications/test-ha` et `/notifications/trigger`.
- `src/backend/routes/actionLogs.js` : création des logs `done` avec `state`, attribution au membre connecté et détection de doublons. Réutiliser ce modèle pour l’acquittement ; examiner/renforcer la validation de l’occurrence et les transitions avant de permettre une validation depuis une notification. Le scheduler actuel ne considère que les réalisations complètes : il faudra prendre en compte la progression par étape.

## Steps

- [x] Clarifier alarmes, téléphones, installation HA, destinataires, étapes et répétitions.
- [x] Examiner le scheduler, les routes, la progression, les formulaires HA et le stockage.
- [x] Définir/valider les schémas de configuration, compatibilité historique et contrat webhook versionné. `NotificationConfig.js`, validation du CRUD actions et contrat `docs/home-assistant.md` ; 19 tests passent.
- [x] Sécuriser le stockage concurrent et introduire l’état interne persistant, exclu du CRUD générique. Mutations fichier sérialisées/renommage atomique ; service interne avec tokens hashés, révocation, expiration et diagnostics filtrés ; protections DataService/API/corbeille. 28 tests passent.
- [x] Centraliser les transitions de progression et intégrer les validations depuis l’interface, les modifications/suppressions de logs et le callback mobile. `ActionProgressService`, réutilisation de `RecurrenceUtils` côté Node, horodatage serveur et révocation ; route callback dédiée. Tests de concurrence, anciens boutons et modification/suppression des logs.
- [x] Implémenter le scheduler par étape, fuseau horaire, silence nocturne et reprises par destinataire ; réutiliser les règles de récurrence existantes en testant leur cohérence frontend/backend. Contrôle 30 s, rappels 10 min persistants, effacement partagé et transport borné/origines autorisées. 36 tests passent.
- [x] Ajouter les routes admin de paramètres/test/diagnostic limitées au collectif et le callback à token limité. Tests HTTP de rôles/isolation, POST-only, token et limitation de débit ; 38 tests passent.
- [x] Étendre les formulaires d’action (y compris copie de modèles), paramètres communs et traductions FR/EN. Responsable/personnes choisies, heure, délais dynamiques, copie avec réactivation explicite ; panneau admin Membres avec test/diagnostic. 41 tests passent ; recette visuelle navigateur à effectuer.
- [ ] Fournir les automatisations HA et tester le bouton/effacement sur Android puis iPhone. **Recette Xiaomi confirmée par l’utilisateur** : réception sonore en silencieux, bouton mobile, rappel à 10 minutes et absence de rappel après validation finale. Recette iPhone **reportée : aucun appareil disponible pour le moment**, confirmé par l’utilisateur. Ne pas annoncer iOS comme validé. L’utilisateur confirme également la validation de la notification et le respect de la plage silencieuse. L’utilisateur confirme la disparition visuelle de la notification après validation : recette Android sur un téléphone terminée pour ce parcours. L’étape reste partielle uniquement pour la recette iPhone reportée et les vérifications multi-appareils ; mode Ne pas déranger non vérifié.
- [x] Compléter les tests et le guide, puis activer explicitement une action pilote avant généralisation. **44 tests automatiques passent au dernier contrôle** ; syntaxe JS et diff vérifiés. Pilote local activé volontairement et testé par l’utilisateur sur Xiaomi, avec notifications réelles et effacement confirmé. Guide actualisé avec les résultats Android et les réserves explicites iPhone/multi-appareils/Ne pas déranger. Aucun déploiement en production ni généralisation ; réserves de l’étape 9 conservées.

## Verification

- `npm test`, `node --check` sur tous les fichiers JS de `src/` et `test/`, et `git diff --check` exécutés après implémentation. Tests isolés en répertoires temporaires/serveurs locaux, sans données ni webhooks de production.
- Horloge simulée : jour/heure prévus, répétition à 10 min, délais relatifs à chaque validation, étape finale, nuit traversant minuit, fuseaux/changements d’heure. Heure locale inexistante : premier instant valide suivant ; heure répétée : une seule première alerte.
- Récurrences ponctuelles/quotidiennes/hebdomadaires/mensuelles, logs historiques et validations tardives ; aucune alerte pour une occurrence déjà terminée. Conserver le comportement de prochaine occurrence non terminée plutôt que diffuser rétroactivement tout l’historique.
- Deux destinataires : réussite de l’un/échec de l’autre, deux clics simultanés, ancien bouton, progression dans l’interface, désactivation/suppression/changement d’affectation. Révoquer les anciens tokens et recalculer l’état actif ; une modification de structure d’étapes invalide les alertes antérieures.
- Redémarrage serveur, indisponibilité HA, retour callback répété/perdu, écriture interrompue : pas de perte de progression ni de rafale ; livraison au moins une fois, pas de garantie d’exactement une notification lors d’un crash entre POST HA et persistance.
- Sécurité : token faux/révoqué, mauvaise occurrence/étape/collectif, droits admin, injection de destinataires, origine webhook non autorisée, masquage des secrets et interdiction du CRUD des données internes.
- Recette Synology → Android + iPhone : test sans modification d’action, vraie alerte à heure choisie, répétition 10 min, bouton « Fait », progression visible dans Feddeeji, arrêt pour tous, étape suivante après délai, silence nocturne et reprise. Vérifier les permissions sonores et le comportement téléphone verrouillé/hors ligne.

## Environnement local préparé

- Copie isolée du code courant : `/tmp/feddeeji-ha-test-jpahna0k` (dossier temporaire, non synchronisé automatiquement).
- Serveur démarré sur le port 3100 ; version et accès HTTP via `192.168.10.102` vérifiés depuis la machine hôte.
- Collectif `test-alarmes`, membres fictifs Test Android (admin) et Test iPhone. Action pilote initialement désactivée, puis activée volontairement par l’utilisateur pour la recette Android.
- Webhook de test associé au membre Android local, URL `https://ha.montgeron.synology.me`. Automatisation dédiée `ha-test-xiaomi.yaml` dans la copie temporaire (secret non publié). Paramètres communs configurés par l’utilisateur : Europe/Paris, silence 23:45–07:00 lors du diagnostic.
- Identifiants générés propres au test, conservés uniquement dans `ACCESS.md` et `.env` de la copie, permissions restreintes.
- `start.sh` permet le redémarrage ; `server.log` et `server.pid` dans la copie.
- L’utilisateur a confirmé l’accès à `/api/version` depuis le Synology et depuis le conteneur `home-assistant-1`.
- L’utilisateur a confirmé une notification HA directe puis le test webhook **Feddeeji local → HA → Xiaomi** reçus avec son via `notify.mobile_app_xiaomi_15_ilya`.
- Commande HA `rest_command.feddeeji_test_ack` installée dans `/volume1/docker/homeassistant/configuration.yaml` ; l’utilisateur confirme HTTP 400 « Bouton invalide » avec un token fictif : retour REST HA → Feddeeji local vérifié.
- Bouton de diagnostic minimal reçu sur Xiaomi et événement utilisateur identifié. Passage à « Lancée » effectué dans l’interface Feddeeji, **pas** via le bouton mobile.
- HA signalait « data must only contain string values » pour les notifications enrichies. Automatisation locale et exemple du guide simplifiés (options facultatives booléennes retirées). L’utilisateur confirme ensuite que le bouton de notification fait passer l’action à **« Vérifiée »** : véritable acquittement mobile Android validé. La cause exacte parmi les options retirées n’est pas isolée.
- L’utilisateur confirme le dernier protocole de recette Android : rappel après 10 minutes sans validation, validation par le bouton mobile, puis absence de rappel pendant la période d’observation après réalisation finale. L’utilisateur confirme ensuite le respect de la plage silencieuse. L’utilisateur confirme également l’effacement visuel après validation. Restent à confirmer explicitement : délai final de 2 minutes et acquittement partagé ; recette iPhone reportée faute d’appareil.
- Exigence complémentaire confirmée : **sonnerie continue jusqu’à validation de l’étape**, pas simplement un canal sonore d’alarme ni des notifications répétées. Le circuit Companion testé ne satisfait pas à lui seul cette exigence ; elle nécessite une étude et une extension du périmètre, non encore implémentées.
- Étudier un composant exécuté sur le téléphone pour jouer la sonnerie en boucle et recevoir l’arrêt après validation (y compris depuis un autre destinataire). Vérifier Android/iOS séparément, fonctionnement écran verrouillé/arrière-plan, début du silence nocturne, arrêt manuel de secours et comportement hors ligne. Ne pas promettre l’arrêt à distance instantané sans connectivité.
- L’utilisateur accepte d’évaluer une substitution : **notification audible en silencieux + répétitions toutes les X minutes**, avant d’engager une solution de sonnerie continue. Tester d’abord `channel: alarm_stream` sur le Xiaomi, à volume d’alarme modéré, puis les rappels et l’arrêt après acquittement. Ne pas promettre le contournement de tous les modes Ne pas déranger.
- L’utilisateur confirme que le son via `alarm_stream` en mode silencieux fonctionne et est **suffisant sur Android** comme substitution à la sonnerie continue. L’automatisation locale `ha-test-xiaomi.yaml` a été ajustée vers ce canal ; l’utilisateur doit reporter cette modification dans HA. Aucun envoi déclenché par l’assistant.
- L’utilisateur confirme le maintien de la fréquence fixe **10 minutes** ; aucun paramétrage X supplémentaire à implémenter. Pas d’application supplémentaire ni d’extension mobile à lancer pour Android. Les répétitions et l’arrêt après validation finale sont désormais confirmés sur Xiaomi. Le comportement Ne pas déranger, l’arrêt partagé et l’iPhone restent à vérifier séparément.

## Paramètres à renseigner lors de l’installation

- Fuseau horaire et horaires de silence du collectif.
- Heure initiale, délais des étapes suivantes et destinataires de chaque action pilote.
- Association des membres aux appareils HA ; Companion et permissions sur iPhone.
- Origine HA autorisée et test du retour vers `https://app.feddeeji.com/`.
