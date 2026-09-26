# Inscrire des membres à toutes les occurrences d’un événement

## Contexte
Permettre d’inscrire des membres à l’avance pour toutes les occurrences d’un événement récurrent, sans devoir les traiter date par date.

Premiers constats : backend Express, frontend JS natif. Les inscriptions actuelles associent un événement, un membre, une date d’occurrence et une réponse. Une route d’enregistrement groupé existe déjà, mais reçoit une liste explicite de dates. Les événements individuels n’acceptent pas d’inscriptions.

## Approche
Validé : inscription durable à toutes les prochaines occurrences jusqu’à désinscription ; admins pour les membres et membres pour eux-mêmes ; exceptions ponctuelles possibles ; réponses existantes préservées. Ne pas matérialiser une liste finie de dates : résoudre une règle de série avec priorité aux réponses explicites par occurrence.

Découvertes complémentaires : le calendrier actuel ne génère que 200 occurrences et sauvegarde toutes les réponses chargées ; il faudra séparer les réponses héritées des modifications explicites. Les rappels ne cherchent actuellement que les inscriptions datées `yes` : leur sélection des destinataires doit utiliser la même résolution que l’interface. Les anciennes inscriptions sans date ciblent la date initiale, elles ne doivent pas devenir implicitement des inscriptions à la série.

### Modèle et règles
- Conserver les inscriptions ponctuelles existantes sans migration. Ajouter dans la même collection un enregistrement `scope: 'series'` par couple événement/membre, portant des périodes `periods: [{ startsOn, endsBefore }]` ; une période ouverte signifie inscrit. Réponse héritée : `yes`.
- Inscription effective à partir du jour courant calculé côté serveur ; désinscription ferme la période à ce jour (borne exclusive), sans effacer le passé. Réinscription ouvre une nouvelle période ; appels répétés idempotents, pas de doublons. Utiliser une convention de date commune serveur/interface (jour UTC, comme le verrouillage actuel).
- Pour une occurrence valide : réponse ponctuelle explicite (`yes`, `no`, `maybe`) prioritaire, sinon `yes` si une période couvre la date, sinon aucune réponse. Une ancienne inscription sans date reste attachée à `event.date`.
- Retirer une exception signifie « revenir à la règle de série », pas « refuser » ; pour décliner, enregistrer `no`. La désinscription de la série conserve toutes les réponses explicites, y compris les `yes` futurs ; expliquer ce comportement dans la confirmation.
- Les dates annulées ne produisent ni participation effective ni rappel. Une modification de récurrence s’applique aux nouvelles dates sans recopier les exceptions ; celles-ci restent attachées à leur date. Une règle de série est inactive si l’événement devient non récurrent ; empêcher cette conversion tant qu’une inscription de série est ouverte, avec message demandant de la clôturer. Conserver le blocage existant de conversion en événement individuel lorsqu’il reste des inscriptions.

### API et interface
- Ajouter `PUT /inscriptions/series` avant `/:id`, recevant `{ eventId, memberId, active }`. Un membre est toujours limité à son propre identifiant ; un admin choisit un membre existant du collectif. Valider corps, événement collectif récurrent et possibilité d’inscription future. Autoriser la clôture même si la série est terminée.
- Sérialiser lecture, validation et écriture avec `EventService.locked`. Réserver les champs de série à cette route : les POST/PUT/bulk ordinaires ne peuvent créer ou modifier ces règles ; leur suppression brute est refusée au profit de la clôture.
- Centraliser validation/résolution des inscriptions ; harmoniser les routes ponctuelles et bulk (réponses autorisées, dates, unicité, membre du collectif, interdiction de modifier le passé pour un membre). Ne pas appliquer à une série le contrôle erroné basé sur la date initiale de l’événement.
- Dans le formulaire d’inscription : choix « Une date » / « Toutes les prochaines dates » pour une récurrence ; en mode série, réponse affirmative et sélection multiple des membres pour l’admin via le composant existant. Appels par membre, idempotents ; signaler les erreurs partielles sans annoncer un succès global.
- Dans la liste : badge « Série », état actif/clôturé, action de désinscription accessible au propriétaire ; ne pas considérer une série active comme passée parce que sa date initiale est ancienne.
- Dans le calendrier : bouton inscription/désinscription de série pour le membre sélectionné ; indication des réponses héritées et retour à la règle de série. Ne sauvegarder que les dates explicitement modifiées, jamais les réponses héritées. Réinitialiser correctement les modifications après sauvegarde/changement de membre et prévenir leur perte.
- Renommer le bouton existant d’application groupée pour préciser sa portée (mois/dates affichées). Générer les occurrences à partir du mois consulté plutôt que d’une liste initiale limitée à 200, afin de vérifier et modifier aussi les dates lointaines ; conserver une fenêtre bornée pour la liste mensuelle.

## Fichiers à modifier
- `src/backend/routes/inscriptions.js` : route de série et validation des mutations ponctuelles.
- `src/backend/services/InscriptionService.js` (nouveau) : mutations de série et validation commune.
- `src/frontend/js/InscriptionUtils.js` (nouveau, navigateur + CommonJS) : résolution pure partagée, aucune logique d’autorisation côté client.
- `src/backend/services/EventNotificationScheduler.js` : destinataires via la résolution partagée, y compris revalidation des alertes déjà actives.
- `src/backend/services/EventService.js` : garde de conversion récurrent/non récurrent.
- `src/frontend/js/views/InscriptionsView.js`, `src/frontend/js/views/InscriptionScheduleView.js` : contrôles et affichage.
- `src/frontend/index.html`, `src/frontend/js/i18n.js` : chargement du helper, textes FR/EN.
- `test/inscriptionSeries.test.js`, `test/inscriptionService.test.js`, `test/inscriptionRoutes.test.js`, `test/inscriptionForms.test.js` (nouveaux), `test/events.test.js` : tests métier, API, interface et rappels.
- `ARCHITECTURE.md` : modèle de série, priorité des exceptions et désinscription.

Les liens des vues événements et programme conduisent déjà aux deux écrans concernés : pas de nouvelle navigation ni de modification nécessaire à ces vues.

## Réutilisation
- `src/backend/routes/inscriptions.js` : route bulk pour les seules exceptions modifiées, filtrage des lectures par membre.
- `EventService.locked`, `EventService.occurrence` dans `src/backend/services/EventService.js` : verrou partagé avec événements/rappels et validation d’une date.
- `src/backend/middleware/memberOwnership.js` : contrôle de propriété réutilisé ; déplacer la validation temporelle des inscriptions dans leur service pour couvrir aussi bulk et séries, sans modifier les autres usages du middleware.
- `src/backend/services/DataService.js` : persistance JSON, journal et corbeille existants ; aucune nouvelle collection nécessaire.
- `src/frontend/js/RecurrenceUtils.js` : calcul des occurrences dans une fenêtre choisie, annulations et fin de récurrence ; modèle d’export partagé navigateur/Node.
- `src/frontend/js/MemberMultiSelect.js` : sélection multiple recherchable déjà disponible.
- `test/events.test.js`, `test/eventForms.test.js` : fixtures API/scheduler et tests de vues avec `node:test`/`vm`.

## Étapes
- [x] Implémenter le résolveur partagé et ses tests (héritage, exceptions, anciennes données, périodes).
- [x] Implémenter le service et l’API idempotente de série sous verrou ; protéger les voies CRUD/bulk et les conversions d’événement.
- [x] Brancher la résolution sur les destinataires des rappels et les revalidations d’alertes.
- [x] Adapter formulaire/liste et calendrier, sélection multiple admin, état modifié uniquement, navigation lointaine et traductions.
- [x] Compléter les tests, la documentation et la vérification manuelle.

## Vérification
- Tests exécutés après implémentation : tests ciblés inscriptions/événements puis `npm test` — **131 tests réussis**. `git diff --check` et vérifications syntaxiques JS réussis.
- Vérification interactive dans un navigateur non effectuée dans cet environnement ; les scénarios API HTTP, vues en VM et rappels ont été exercés automatiquement.
- Résolution : occurrence dans plusieurs années sans matérialisation, début/fin de période, désinscription/réinscription sans altérer le passé, `no`/`maybe`/`yes` explicites préservés, suppression d’exception, anciennes inscriptions sans date, annulation/rétablissement et fin de récurrence.
- API : admin pour plusieurs membres, membre pour lui-même seulement, isolation des collectifs, événement individuel/non récurrent inexistant ou terminé, corps invalide, refus des dates passées côté membre y compris bulk, protection des champs de série, appels concurrents/répétés sans doublon.
- Rappels : héritage `yes` sélectionné, exception `no`/`maybe` exclue, aucune notification sur date annulée ; désinscription/exception invalident une alerte devenue inéligible et son ancien bouton.
- Interface : réponses héritées visibles mais absentes du payload bulk ; refus ponctuel puis retour à la série ; navigation au-delà d’un an ; absence de fuite de modifications entre membres ; erreurs partielles multi-membres et textes FR/EN.
- Manuel admin puis membre : inscrire deux membres à la série, conserver un refus existant, décliner une date, se désinscrire puis se réinscrire, recharger l’application et vérifier dates lointaines et rappels. Confirmer l’absence de régression pour les événements uniques et individuels.

## Décisions utilisateur
Les quatre points ci-dessus sont confirmés (réponse « Oui aux 3 » aux trois questions regroupées).
