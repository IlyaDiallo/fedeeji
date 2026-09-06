# Plan — Illustrations dessinées et identité par collectif

## Context

La médiathèque actuelle fournit des photos Wikimedia pour les activités et leurs étapes. Elle apporte de la variété, mais pas une identité visuelle homogène. Les actions du programme (`actions.json`) sont aujourd’hui libres (`name`, planning, description…) et n’ont ni catégorie ni illustration ; les exemples réels concernent notamment lessive, déchets, nettoyage, livraison et maintenance.

Décisions prises :

- identité **dessinée à la main**, sous la forme d’un trait de feutre légèrement irrégulier sur une forme organique colorée ;
- une illustration propre à chaque action, avec suggestions à partir de son nom, sans imposer de catégories ;
- les photos des activités et des étapes restent des photos et conservent leur flux Wikimedia actuel ;
- catalogue et pipeline entièrement locaux, sans IA ni dépendance réseau en production ;
- chaque collectif choisit une couleur principale ; une seconde couleur harmonisée est calculée automatiquement.

## Approach

### Bibliothèque locale

Embarquer `@iconify-json/tabler` : 6 232 pictogrammes vectoriels cohérents, environ 2,1 Mo décompressés, licence MIT. Tabler fournit la base sémantique ; l’application ne montrera jamais l’icône brute.

La recherche locale :

- normalisera casse et accents ;
- classera les noms d’icônes par correspondance exacte, préfixe puis mots partiels ;
- traduira les termes courants grâce à un petit index de synonymes FR/EN, initialement orienté tâches collectives et domestiques (nettoyage, linge, déchets/recyclage, cuisine, jardin, courses, bricolage, livraison/réception, administratif, soin, transport, événement) ;
- proposera automatiquement des résultats d’après le nom saisi, sans remplacer une illustration déjà choisie.

### Moulinette Feddeeji

Créer un `IllustrationService` distinct du `AssetService` photo. À partir du SVG Tabler autorisé, il produira localement un SVG Feddeeji `doodle-v1` :

- fond organique déterministe dans la couleur secondaire ;
- pictogramme dans la couleur principale, trait rond légèrement déplacé et doublé pour l’effet feutre ;
- petites marques décoratives déterministes ;
- variante compacte, moins détaillée, pour les listes et calendriers ;
- aucun script, lien, image distante, HTML ou SVG fourni par l’utilisateur.

Une action stockera une recette, pas les couleurs ni un fichier opaque :

```json
{
  "illustration": {
    "collection": "tabler",
    "name": "wash",
    "style": "doodle-v1",
    "seed": 18427
  }
}
```

Le serveur rendra l’illustration à la demande via une route publique strictement bornée au catalogue local. Un `ETag` dépendant de l’icône, de la recette et des couleurs permettra le cache tout en reflétant immédiatement un changement de couleur. Les anciennes actions sans recette utiliseront une illustration générique déterministe ; aucune migration destructive n’est nécessaire.

### Couleurs du collectif

Ajouter `primaryColor` au collectif. Le backend validera le format hexadécimal et calculera les tokens dérivés :

- `secondaryColor` par harmonie analogue avec rotation de teinte stable ;
- variante sombre pour survol/contraste ;
- couleur de texte noire ou blanche selon la luminance.

Les valeurs par défaut reprendront l’identité actuelle. Le superadmin choisira la couleur principale dans les formulaires de création/édition et verra la bichromie résultante. `app.js` appliquera les tokens au chargement de chaque collectif, y compris sur sa page de connexion ; les illustrations se recoloreront automatiquement.

### Expérience d’édition des actions

Dans la modale d’action :

- afficher l’illustration courante à côté du nom ;
- ouvrir un panneau de bibliothèque locale avec suggestions automatiques, recherche manuelle et grille responsive ;
- conserver le choix lors d’une modification et le recopier depuis un modèle d’action ;
- fournir une illustration générique si l’utilisateur ne choisit rien ;
- afficher la version compacte dans la liste et le calendrier du programme.

La bibliothèque d’illustrations reste distincte des onglets Photos de `ActivitiesView` : les photos de couverture et d’étapes ne sont ni filtrées ni vectorisées.

## Files to modify

### Backend

- **Nouveau** `src/backend/services/IllustrationService.js` — chargement/indexation Tabler, synonymes, validation de recette, calcul déterministe et rendu SVG.
- `src/backend/services/CollectiveService.js` — validation de `primaryColor` et calcul des tokens dérivés à la création/mise à jour.
- `src/backend/routes/assets.js` — endpoint authentifié de recherche locale d’illustrations.
- `src/backend/routes/actions.js` — normalisation/validation de la recette avant stockage.
- `src/backend/routes/api.js` — injection de l’`IllustrationService` dans les routeurs concernés.
- `src/backend/routes/auth.js` — transmission de `primaryColor` et protection effective des modifications de collectif par `requireSuperadmin`.
- `src/backend/server.js` — initialisation du service et route publique de rendu SVG avec `ETag`.

### Frontend

- **Nouveau** `src/frontend/js/IllustrationPicker.js` — recherche, suggestions, sélection et aperçu réutilisables.
- `src/frontend/index.html` — chargement du nouveau composant.
- `src/frontend/js/api.js` — recherche locale d’illustrations.
- `src/frontend/js/app.js` — cache du thème courant et injection des variables CSS dérivées.
- `src/frontend/js/views/CollectiveListView.js` — sélecteur de couleur principale et aperçu de la bichromie dans création/édition.
- `src/frontend/js/views/ProgrammeView.js` — panneau de bibliothèque dans la modale d’action et transmission du collectif aux renderers.
- `src/frontend/js/ActionFormManager.js` — état de la recette, suggestions sur le nom, copie depuis un modèle et sauvegarde.
- `src/frontend/js/ProgrammeRenderers.js` — illustration compacte des actions dans les vues liste et calendrier.
- `src/frontend/css/style.css` — tokens dynamiques, sélecteur, grille, cartes et tailles compactes.
- `src/frontend/js/i18n.js` — libellés FR/EN.

### Projet

- `package.json` / `package-lock.json` — dépendance locale `@iconify-json/tabler` et commande de test Node.
- **Nouveau** `test/illustrationService.test.js` — tests du catalogue, du rendu et des entrées hostiles.
- `ARCHITECTURE.md` — modèle, routes et pipeline d’illustration.

## Reuse

- Garder `src/backend/services/AssetService.js` et son flux Wikimedia inchangés pour les photos.
- Étendre le routeur `src/backend/routes/assets.js` sans casser `/search` et `/import`.
- Réutiliser le CRUD générique de `DataService` après validation spécialisée dans `routes/actions.js`.
- Étendre l’état et les hooks existants de `ActionFormManager` (`open`, `_populateFromAction`, `_onTemplateChange`, `save`).
- Étendre les points de rendu purs de `ProgrammeRenderers.renderActionItem` et `renderCalendarGrid`.
- Appliquer la palette via les variables `--fd-*` déjà centralisées dans `src/frontend/css/style.css`.
- Réutiliser les formulaires création/édition existants de `CollectiveListView`.

## Steps

- [x] Valider le style feutre/forme organique, une illustration par action, le pipeline local et la couleur secondaire automatique.
- [x] Ajouter la dépendance Tabler et implémenter l’index de recherche bilingue pondéré.
- [x] Implémenter et tester le générateur SVG déterministe `doodle-v1`, sa variante compacte et la validation des recettes.
- [x] Exposer la recherche authentifiée et le rendu public avec validation, cache et `ETag`.
- [x] Ajouter `primaryColor`, calculer la palette accessible et sécuriser les routes de modification des collectifs.
- [x] Ajouter les contrôles de couleur et l’aperçu de bichromie dans la gestion des collectifs.
- [x] Appliquer les tokens du collectif à toute l’interface lors du routage.
- [x] Intégrer le sélecteur d’illustration et les suggestions dans le formulaire d’action.
- [x] Conserver/recopier la recette lors des éditions et usages de modèles, avec fallback pour l’existant.
- [x] Afficher les illustrations dans les listes et calendriers sans surcharger les petits écrans.
- [x] Paramétrer le terme concret de chaque collectif et l’utiliser dans son espace.
- [x] Permettre au superadmin de choisir un logo dans le catalogue local d’illustrations.
- [x] Simplifier les messages d’accueil par défaut.
- [x] Compléter les traductions et la documentation.

## Verification

### Automatique

- Tester la recherche exacte, partielle, sans accents et les synonymes FR/EN (`lessive → wash`, `aspirateur → vacuum-cleaner`, etc.).
- Tester que le même nom + style + graine + palette produit exactement le même SVG.
- Tester qu’une autre graine varie les détails sans changer le pictogramme.
- Tester le calcul de palette, le choix automatique du texte contrasté et les couleurs invalides.
- Tester le rejet des noms hors catalogue, traversées de chemin, styles inconnus et paramètres hors limites.
- Vérifier que le SVG produit ne contient ni script, événement, URL externe ni balise active.
- Tester les réponses HTTP `Content-Type`, `ETag`, `304`, droits admin pour la recherche et fallback d’une action historique.
- Exécuter `npm test`, `node --check` sur les fichiers JS et `git diff --check`.

### Manuel

- Créer puis modifier un collectif et vérifier l’aperçu, la navigation et la bichromie sur pages publiques/authentifiées.
- Créer une action « Lessive », vérifier les suggestions, choisir une illustration, enregistrer puis rééditer.
- Créer une action depuis un modèle et vérifier que son illustration est recopiée mais reste modifiable.
- Vérifier les versions liste et calendrier sur PC et mobile, en thème clair et avec des couleurs très claires/sombres.
- Modifier la couleur principale et vérifier que toutes les illustrations existantes changent sans modifier les actions.
- Vérifier que les photos Wikimedia, uploads et attributions des activités fonctionnent exactement comme avant.
- Couper le réseau et vérifier que recherche, aperçu et rendu des illustrations restent disponibles.
