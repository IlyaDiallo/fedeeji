# Alarmes Home Assistant — contrat v1

> **Recette locale Android réalisée avec l’utilisateur sur Xiaomi** : notification sonore
> en silencieux, bouton Fait, répétition toutes les 10 minutes, arrêt après validation
> finale, respect de la plage silencieuse et disparition de la notification confirmés.
> Une action pilote locale a été activée volontairement. Aucun déploiement en production.
>
> **Restent non vérifiés sur appareils réels :** iPhone (appareil indisponible), arrêt
> partagé entre plusieurs téléphones et mode Ne pas déranger. La checklist ci-dessous
> conserve le protocole complet pour ces tests et les futures installations.
>
> **Migration :** l’ancien rappel journalier automatique est remplacé par l’activation
> explicite par action. Configurez d’abord les paramètres communs et les automatisations
> ci-dessous. Le test existant nécessite désormais une origine HA autorisée.

Feddeeji décide du planning ; Home Assistant relaie les notifications Companion et
le bouton **Fait**. Un succès HTTP signifie « accepté par HA », pas « reçu sur le téléphone ».

## Configuration

Une action sans `alert` reste historique : aucune activation implicite des rappels
insistants. Désactivation explicite : `{"enabled": false}`.

```json
{
  "alert": {
    "version": 1,
    "enabled": true,
    "initialTime": "09:00",
    "recipientMode": "selected",
    "memberIds": ["identifiant-membre"],
    "stepDelayMinutes": [30, 120]
  }
}
```

- `recipientMode` : `responsible` utilise le `memberId` de l’action ; `selected`
  exige une liste non vide de membres du même collectif. Aucun fallback vers tous.
- Premier rappel : jour de l’occurrence à `initialTime`, pas au début de `windowDays`.
- `states` contient les libellés intermédiaires ; la réalisation finale est implicite.
  Il faut donc exactement `states.length` délais, entiers de 0 à 527040 minutes.
- Chaque délai part de la validation de **l’étape précédente**, jamais de la première.
- Répétition fixe de 10 minutes après un envoi réussi, par destinataire.
- Valider une étape arrête les rappels de cette étape pour tout le monde.

Paramètres communs, administrés par collectif (aucune valeur de production implicite) :

```json
{
  "version": 1,
  "timeZone": "Europe/Paris",
  "quietStart": "22:00",
  "quietEnd": "08:00",
  "allowedOrigins": ["https://ha.example.org"],
  "insecureTlsOrigins": []
}
```

Les horaires ci-dessus sont des exemples à adapter. Le fuseau est explicite ; début
et fin du silence doivent différer. Une origine privée HTTP est possible pour HA
local, mais seuls les serveurs autorisés administrativement doivent être joignables.
Les exceptions TLS sont explicites, limitées aux origines HTTPS déjà autorisées.
Le silence suspend les envois, pas les délais ni les validations. À la reprise,
un seul rappel pertinent, sans rafale. Les alarmes ne contournent pas forcément
le mode silencieux/Ne pas déranger, notamment sur iPhone.

## Payload webhook v1

Les champs historiques `action`, `status`, `date`, `collective`, `collectiveId`,
`description` restent disponibles. Nouveaux champs :

```json
{
  "version": 1,
  "type": "reminder",
  "action": "Lessive",
  "status": "due",
  "date": "2026-06-01",
  "collective": "Maison",
  "collectiveId": "maison",
  "description": "",
  "notificationId": "identifiant-stable-par-occurrence-et-etape",
  "step": 1,
  "stepLabel": "Lancée",
  "button": {"title": "Fait", "action": "FEDDEEJI_<token-opaque>"}
}
```

`type: clear` avec le même `notificationId` demande l’effacement. `type: test`
ne doit jamais proposer un bouton modifiant une vraie action.
Le token du bouton est propre au destinataire/occurrence/étape. Seul son hash est
persisté ; il ne doit figurer ni dans les logs applicatifs ni dans une URL GET.
Le callback est un POST JSON `{"token":"…"}` vers
`https://app.feddeeji.com/notification-callbacks/ack` (URL fixe dans HA).
Les clics répétés ou tardifs ne doivent jamais faire avancer l’étape suivante.

## Stockage et déploiement

Le stockage fichier reste **mono-processus Node** : sérialisation locale et renommage
atomique protègent les mutations concurrentes, pas plusieurs workers/instances.
Une future exploitation multi-processus nécessite transactions/verrous distribués.
Les données techniques sont conservées dans `notification-state`, exclusivement via
le service interne ; elles ne sont accessibles ni par le CRUD générique ni par la
corbeille et ne passent pas par la journalisation complète de `DataService`.

## Installation dans Feddeeji

1. Dans **Membres → Alarmes : paramètres communs au collectif**, renseigner le fuseau,
   le début/fin du silence et l’origine de HA (par exemple `https://ha.example.org`).
   Une origine = protocole + hôte + port, sans `/api/webhook/...`. Conserver les exceptions
   TLS vides si le certificat est valide. HTTP local est possible, mais non chiffré.
2. Sur chaque fiche membre, conserver/renseigner l’URL de base HA et un webhook secret
   propre au membre. Le webhook doit être joignable depuis le serveur Feddeeji.
3. Installer/configurer Companion sur iPhone ; associer chaque téléphone à un membre.
   Utiliser de préférence un compte HA distinct par personne. Ne pas partager les IDs
   webhook, les tokens de boutons ou les traces HA : ce sont des secrets.
4. Installer les automatisations ci-dessous. Désactiver les anciennes automatisations
   qui traitent le même webhook pour éviter les doublons.
5. Utiliser le test du panneau Membres en choisissant un membre. Ce test est **immédiat,
   même pendant le silence**, sans bouton qui puisse modifier une action.
6. Dans une action, choisir le responsable ou les destinataires, activer les rappels,
   renseigner l’heure initiale et chaque délai en minutes. Un délai 0 est autorisé.
   Une copie de modèle conserve les paramètres mais laisse les rappels désactivés.

## Automatisations HA

Références officielles consultées :
- https://companion.home-assistant.io/docs/notifications/actionable-notifications/
- https://companion.home-assistant.io/docs/notifications/notifications-basic/

Les exemples suivants sont à adapter puis vérifier avec **Vérifier la configuration**
dans HA. Aucun accès au NAS n’a été utilisé pour les tester. `notify.mobile_app_...`
est le nom réel du service de notification du téléphone, visible dans Outils de
Développement → Actions. Créer une réception par membre ; si un membre utilise deux
appareils, envoyer aux deux services dans chaque branche.

### 1. Retour HTTPS, dans `configuration.yaml`

Fusionner avec votre bloc `rest_command` existant, ne pas créer deux clés identiques :

```yaml
rest_command:
  feddeeji_ack:
    url: "https://app.feddeeji.com/notification-callbacks/ack"
    method: POST
    content_type: "application/json"
    payload: '{{ {"token": token} | tojson }}'
    verify_ssl: true
    timeout: 10
```

Recharger les commandes REST ou redémarrer HA selon votre version. Ne pas remplacer
cette URL fixe par une URL fournie dans la notification.

### 2. Réception webhook, dans l’éditeur YAML d’une automatisation

Remplacer `REMPLACER_PAR_UN_WEBHOOK_SECRET` et `notify.mobile_app_mon_telephone`.
Pour un webhook accessible depuis Internet, `local_only: false` est nécessaire ; ne
pas exposer tout HA sans HTTPS/authentification. Un webhook HA est authentifié par son
ID secret : le conserver long, aléatoire, et le révoquer s’il est divulgué.

```yaml
alias: Feddeeji - notifications Alice
mode: queued
max: 20
trace:
  stored_traces: 0
triggers:
  - trigger: webhook
    webhook_id: REMPLACER_PAR_UN_WEBHOOK_SECRET
    allowed_methods: [POST]
    local_only: false
conditions:
  - condition: template
    value_template: >-
      {{ trigger.json is defined and trigger.json.version == 1
         and trigger.json.type in ['reminder', 'clear', 'test'] }}
actions:
  - choose:
      - conditions: "{{ trigger.json.type == 'clear' }}"
        sequence:
          - action: notify.mobile_app_mon_telephone
            data:
              message: clear_notification
              data:
                tag: "{{ trigger.json.notificationId }}"
    default:
      - action: notify.mobile_app_mon_telephone
        data:
          title: "{{ trigger.json.collective }} — {{ trigger.json.action }}"
          message: >-
            {{ trigger.json.stepLabel | default('Test Feddeeji') }}
            {{ trigger.json.description | default('') }}
          data:
            tag: "{{ trigger.json.notificationId }}"
            channel: Feddeeji
            importance: high
            priority: high
            ttl: 0
            actions: >-
              {{ [{'action': trigger.json.button.action,
                   'title': trigger.json.button.title}]
                 if trigger.json.type == 'reminder' else [] }}
```

L’exemple utilise des boutons minimaux (`action` et `title` seulement). La recette sur
Xiaomi a montré un rejet du service push « data must only contain string values »
avec le payload enrichi ; la notification manuelle à bouton minimal fonctionne.
Les options facultatives `authenticationRequired`, `alert_once` et le bloc iOS `push`
sont donc omis ici pour isoler l’incompatibilité. La correction du webhook reste à
confirmer sur le téléphone. Ne pas convertir tout le tableau `actions` en texte :
il doit rester une liste. Sans `authenticationRequired`, cet exemple n’impose pas le
déverrouillage pour appuyer ; le contrôle utilisateur HA et le token restent requis.

`channel`, `importance`, `priority` et `ttl` concernent Android. Dans Android, vérifier
manuellement que le canal **Feddeeji** a un son
et une importance élevée : une automatisation ne remplace pas les réglages d’un canal
déjà créé. Sur iPhone, autoriser les notifications et sons, et vérifier les modes
Concentration. Il s’agit de notifications répétées, **pas d’une sonnerie continue**.

### 3. Bouton Fait, une automatisation par utilisateur HA autorisé

Dans Outils de Développement → Événements, écouter temporairement
`mobile_app_notification_action` lors de la recette et relever `context.user_id`.
Ne pas publier l’événement complet : il contient le token. Remplacer
`REMPLACER_PAR_USER_ID_HA` par l’identifiant du compte HA du destinataire, pas son nom.
Si `context.user_id` est absent sur votre installation, ne pas enlever le contrôle :
il faut d’abord adapter/vérifier l’identité réellement disponible. Avec un compte
HA partagé, l’attribution est celle du membre destinataire du token, pas nécessairement
la personne physique ayant appuyé ; des comptes distincts sont recommandés.

```yaml
alias: Feddeeji - validation Alice
mode: queued
max: 20
trace:
  stored_traces: 0
triggers:
  - trigger: event
    event_type: mobile_app_notification_action
conditions:
  - condition: template
    value_template: >-
      {{ trigger.event.context.user_id == 'REMPLACER_PAR_USER_ID_HA'
         and trigger.event.data.action is defined
         and trigger.event.data.action is match('^FEDDEEJI_[A-Za-z0-9_-]{43}$') }}
actions:
  - action: rest_command.feddeeji_ack
    data:
      token: "{{ trigger.event.data.action[9:] }}"
    response_variable: acknowledgement
  - if:
      - condition: template
        value_template: "{{ acknowledgement.status != 200 }}"
    then:
      - action: persistent_notification.create
        data:
          title: Feddeeji
          message: >-
            Validation non confirmée. Ouvrir Feddeeji pour vérifier l’étape.
            Un ancien bouton ou un double clic ne valide jamais l’étape suivante.
```

Le préfixe `FEDDEEJI_` a 9 caractères. Pas de boucle de rappels dans HA : Feddeeji
les pilote. Un bouton hors ligne peut ne pas parvenir au serveur ; seule la progression
visible dans Feddeeji confirme la réalisation. Un deuxième clic sur un token révoqué
renvoie 409 et ne modifie rien. Un effacement visuel ne vaut pas acquittement.
Éviter l’enregistrement des événements de boutons dans le Recorder et tout logger
de débogage HTTP contenant le payload ; fusionner si nécessaire dans `recorder.exclude.event_types`
la valeur `mobile_app_notification_action` (et `mobile_app_notification_cleared`).

## Substitution à une alarme sur Android

Lors de la recette, l’utilisateur a confirmé que le Xiaomi reçoit un son en mode
silencieux avec `channel: alarm_stream` et considère ce comportement suffisant, combiné
aux rappels. Pour le reproduire, remplacer uniquement le canal de l’automatisation de
réception Android par :

```yaml
channel: alarm_stream
```

Conserver `priority: high`, `ttl: 0` et les boutons minimaux validés. Le volume des
alarmes doit être non nul. Ce n’est pas une sonnerie continue ; le comportement en
mode Ne pas déranger reste à vérifier séparément. Les rappels restent actuellement
fixes à **10 minutes**, hors plage silencieuse commune ; aucune fréquence X configurable
n’est encore implémentée. L’acquittement d’étape continue d’arrêter les rappels associés.
Cette validation Android ne constitue pas une validation iPhone.

## Recette et activation progressive (à réaliser)

- [ ] Vérifier la configuration YAML et la connectivité HA → URL publique Feddeeji.
- [ ] Test simple Android puis iPhone : réception, son et téléphone verrouillé.
- [ ] Créer une **action pilote de test**, deux étapes intermédiaires et deux destinataires,
      heure quelques minutes dans le futur, délais 1 puis 2 minutes ; l’activer explicitement.
- [ ] Vérifier premier envoi, répétition après 10 minutes et remplacement (même tag).
- [ ] Appuyer sur **Fait** depuis Android : un seul log serveur, arrêt des rappels pour tous,
      demande d’effacement sur les deux appareils dans les 30 secondes environ.
- [ ] Vérifier l’étape 2 après 1 minute ; la valider depuis iPhone puis vérifier l’étape finale
      2 minutes après cette validation, et non après l’étape 1.
- [ ] Réessayer un ancien bouton et deux clics simultanés : aucune étape supplémentaire.
- [ ] Vérifier une validation depuis Feddeeji, la désactivation et la suppression de l’action.
- [ ] Programmer une plage silencieuse de test ; vérifier suspension et reprise sans rafale.
- [ ] Couper/rétablir HA puis redémarrer Feddeeji : pas de perte de progression, reprises
      par destinataire. Aucune garantie d’exactement un envoi en cas de crash après POST HA.
- [ ] Après succès, supprimer/désactiver le pilote et activer les vraies actions choisies.

L’effacement est **best effort** : selon Companion, iOS et Android peuvent nécessiter
une utilisation récente de l’application. L’arrêt des rappels côté serveur est la
référence, même si une ancienne notification reste affichée sur un appareil hors ligne.
Le diagnostic distingue acceptation HA, échecs consécutifs et prochaine tentative ;
les avertissements signalent les paramètres ou destinataires manquants. L’activation
réelle du pilote et les essais physiques ne peuvent pas être faits depuis ce dépôt.
