# Fenêtres de réalisation des actions

Une occurrence prévue le jour J peut être réalisée entre **J − `windowDays`** et
**J + `windowAfterDays`**, bornes inclusives, en jours calendaires.

- `windowDays` : nombre de jours avant l’échéance (champ existant).
- `windowAfterDays` : nombre de jours après l’échéance (nouveau champ).
- Les deux valeurs sont des entiers de 0 à 36500 ; une valeur absente vaut 0.
- Exemple : échéance le 8 mai, 2 jours avant et 1 après → du 6 au 9 mai inclus.

## Programme

« Maintenant » ne présente aucune date pour les actions et ne propose qu’une
instance par action : celle d’aujourd’hui ou la prochaine dont la fenêtre est
ouverte ; sinon la dernière instance passée non terminée, seulement si sa fenêtre
est encore ouverte. Les occurrences annulées sont ignorées.

« En retard » apparaît uniquement après l’échéance et pendant les jours après
explicitement autorisés. Une instance terminée ou expirée n’est plus proposée.
Aucun rattrapage automatique des anciennes occurrences. Une étape intermédiaire
ne prolonge pas la fenêtre.

Les instances passées restent consultables dans le calendrier. Les définitions
d’actions expirées non terminées restent accessibles dans les réglages pour
modifier leur fenêtre.

## Validation et correction

Pour les membres, le jour courant **et** la date de réalisation saisie doivent
appartenir à la fenêtre. Antidater une saisie ne permet pas de contourner sa
fermeture. La restriction est contrôlée côté serveur, y compris pour les boutons
Home Assistant, les modifications et les suppressions de réalisations.

Les administrateurs et superadministrateurs peuvent corriger rétroactivement
une occurrence passée depuis le calendrier, même hors fenêtre (création,
modification, suppression). La date saisie ne peut pas être future. Le rôle est
celui de l’identité authentifiée, jamais un champ du corps de la requête. Un
bouton Home Assistant ne bénéficie jamais de cette exception.

Les notes restent accessibles indépendamment de la fenêtre. Les réalisations
historiques ne sont ni supprimées ni réécrites par cette évolution.

## Rappels

Le scheduler utilise les mêmes bornes et la même sélection d’occurrence que le
programme. La fermeture arrête les rappels, révoque les boutons et efface les
notifications actives, même pendant les heures de silence. Le serveur refuse un
bouton hors fenêtre sans attendre le prochain passage du scheduler.

Le jour serveur utilise le fuseau configuré pour le collectif dans les réglages
de notifications ; à défaut, celui du serveur. Le programme utilise le jour local
du navigateur, comme auparavant. Les corrections d’instances expirées ne rouvrent
pas leur fenêtre et ne relancent pas leurs rappels.

## Actions existantes

Sans `windowAfterDays`, la fenêtre ferme désormais le jour prévu. Les anciennes
instances dépassées disparaissent donc de « Maintenant » ; pour autoriser un
retard, modifier explicitement « jours après l’échéance » dans l’action.
