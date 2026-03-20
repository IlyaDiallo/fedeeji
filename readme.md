Feddeeji

Application de gestion d'organisation

frontend JS (minimum de sépendances, style visuel bootstrap), backend node.js
Stockage des données en json ou binaire, passant par une couche d'abstraction, implémentation soit en fichier par le fs local, soit en bdd MongoDB, soit Amazon S3
On peut gérer plusieurs organisation dans une même instance de l'application et une même "base" de données
L'application doit être multi-langues, au départ en français et en anglais
Chaque organisation a son chemin d'accès dans l'url, aucun partage de données entre les organisations à part l'utilisateur superadmin qui voit toutes les organisations
La liste des organisations est stockée dans un fichier json dans le dossier de l'application (nom, libellé, email admin, langue par défaut)
Le mot de passe de l'utilisateur superadmin de base est stocké en variable d'environnement
On doit avoir une fonction de corbeielle pour les opérations de suppression faites par un utilisateur
Les opérations utilisateur (ajout/modification/suppression) sont journalisées
L'application doit être responsive et s'adapter à tous les écrans et un usage tactile

Fonctionnalités:
- gestion des utilisateurs et rôles admin (ajout, modification, suppression, recherche)
- gestion des membres (ajout, modification, suppression, recherche)
- gestion des cotisations (ajout, modification, suppression, recherche)
- gestion des événements (ajout, modification, suppression, recherche)
- gestion des participations aux événements (ajout, modification, suppression, recherche)
- planning interactif des événenements

Fonctionnalités futures:

- publications publiques et privées
- actions (groupes de publications et d'événements)
- envois d'emails aux membres
- gestion des groupes (ajout, modification, suppression, recherche)
- gestion des statistiques (ajout, modification, suppression, recherche)
- gestion des rapports (ajout, modification, suppression, recherche)
- gestion des exports (ajout, modification, suppression, recherche)
- gestion des imports (ajout, modification, suppression, recherche)
- gestion des sauvegardes (ajout, modification, suppression, recherche)
- gestion des restaurations (ajout, modification, suppression, recherche)
