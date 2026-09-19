# Programme — Repérage de ses actions

## Context
Distinguer visuellement, dans le Programme, les actions dont la personne connectée est responsable ou coresponsable.

Les responsables sont déjà sélectionnés dans `ActionFormManager.js` et enregistrés dans `memberIds`, avec repli historique sur `memberId`. Les rendus du Programme sont centralisés dans `ProgrammeRenderers.js` et pilotés par `views/ProgrammeView.js`.

Décision utilisateur : repère discret, sans texte visible, dans toutes les vues du Programme (Maintenant, liste/Paramétrage, semaine et mois).

## Approach
Distinguer les deux situations par une seule petite icône :
- `bi-person-fill` : vous êtes l’unique responsable ;
- `bi-people-fill` : vous êtes coresponsable.

Pour ne consommer aucune largeur supplémentaire, superposer le repère dans un coin de l’illustration existante, dans une boîte identique d’environ 12–14 px, contenue dans son emprise. Conserver les dimensions des illustrations et tout l’espace disponible pour les noms, y compris en calendrier mobile. Utiliser la couleur principale du collectif (`--fd-primary`) avec un fin halo neutre pour rester lisible sur le dessin, sans badge ni texte visible. La différence de silhouette, et non de couleur, distingue les deux situations. Infobulle native et libellé accessible traduits : « Vous êtes l’unique responsable » ou « Vous êtes coresponsable ». Les couleurs de statut restent inchangées.

Transmettre explicitement le membre connecté depuis `ProgrammeView` aux rendus purs, via `api.getMemberId()`, uniquement si `api.getUserOrgId()` correspond au collectif affiché. Ne pas conditionner au rôle : un administrateur lié à un membre responsable doit aussi voir le repère. Sans membre identifié, aucun repère.

Centraliser dans `ProgrammeRenderers` un petit helper de rendu du repère : tester l’appartenance à `action.memberIds ?? (action.memberId ? [action.memberId] : [])`. Un tableau vide reste une absence d’attribution, même si l’ancien `memberId` est présent. Compter les identifiants distincts non vides : un seul donne l’icône individuelle, plusieurs l’icône de groupe, uniquement si le membre connecté en fait partie. Réutiliser ce helper dans un wrapper d’illustration commun en liste, Maintenant et cellule de calendrier (contexte transmis par la grille), sans ajouter le repère aux illustrations hors de ces vues. Aucun changement backend, de droits, de tri, de filtre, d’événements ou d’historique des réalisations.

## Files to modify
- `src/frontend/js/ProgrammeRenderers.js` — repère dans les rendus concernés.
- `src/frontend/js/views/ProgrammeView.js` — transmission du contexte de connexion.
- `src/frontend/css/style.css` — présentation responsive.
- `src/frontend/js/i18n.js` — libellés français et anglais.
- **Nouveau** `test/programmeResponsibility.test.js` — tests du repère et de sa propagation.

## Reuse
- `src/frontend/js/ActionFormManager.js` : sélection des responsables et champ `memberIds`.
- `src/frontend/js/ProgrammeRenderers.js` : `renderActionItem`, `renderNow`, `renderCalendarGrid`, `renderCalendarActionCell` ; badges de statut à préserver.
- `src/frontend/js/api.js` : `getMemberId()` et `getUserOrgId()` ; aucun nouvel appel réseau.
- `src/frontend/js/ActionFormManager.js:44` : convention de repli des responsables historiques.
- `src/frontend/css/style.css` : token `--fd-primary` et styles des titres/illustrations.
- `test/programmeIllustrations.test.js` et `test/programmeAgenda.test.js` : chargement des classes frontend avec `node:vm`.
- `test/actionResponsibles.test.js` : sémantique existante du tableau vide et du repli historique.

## Steps
- [x] Transmettre l’identité du membre aux trois points d’entrée de rendu et jusqu’aux cellules calendrier, avec valeur absente compatible avec les appels existants.
- [x] Ajouter le helper commun distinguant responsabilité unique et partagée, et superposer l’icône à l’illustration dans chaque vue.
- [x] Adapter le wrapper aux dimensions existantes des illustrations ; positionner le repère sans modifier largeur, hauteur ni espacement des lignes. Ajouter les deux libellés accessibles/infobulles FR et EN, sans remplacer le titre existant des actions.
- [x] Tester responsabilité individuelle, coresponsabilité, identifiants dupliqués, autre membre, identité absente, autre collectif, ancien `memberId`, tableau vide prioritaire et absence de responsables.

## Verification
- Exécuter `node --test test/programmeResponsibility.test.js test/programmeAgenda.test.js test/programmeIllustrations.test.js`, puis `npm test`.
- Vérifier la présence/absence du repère dans Maintenant, liste et grilles semaine/mois ; les événements ne reçoivent aucun repère. Vérifier les deux silhouettes et leurs libellés accessibles, sans texte visible ; des doublons d’un même responsable ne doivent pas produire une icône de groupe.
- Sur mobile et ordinateur : noms longs, illustrations, icônes de notes, états terminés/en retard/expirés/annulés ; aucun débordement ni changement des couleurs ou contrôles existants. Comparer les dimensions avec et sans repère : aucune place supplémentaire consommée ; vérifier la lisibilité des deux silhouettes sur les illustrations compactes.
- Avec un membre puis un administrateur responsable : attribution individuelle, partagée, retrait des responsables puis rechargement ; vérifier aussi un compte sans membre associé et un autre collectif.
