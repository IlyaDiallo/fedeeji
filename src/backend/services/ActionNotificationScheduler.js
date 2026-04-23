const NotificationService = require('./NotificationService');

// ---------- Utilitaires de récurrence (version Node.js) ----------

/**
 * Formate une Date en chaîne YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
function formatDateStr(date) {
    return date.toISOString().slice(0, 10);
}

/**
 * Avance la date courante d'un pas de récurrence.
 * @param {Object} params
 * @param {Date}   params.current    - Date à muter
 * @param {string} params.recurrence - 'daily' | 'weekly' | 'monthly'
 * @param {number} params.interval   - Intervalle
 */
function advanceDate({ current, recurrence, interval }) {
    if (recurrence === 'daily') {
        current.setDate(current.getDate() + interval);
    } else if (recurrence === 'weekly') {
        current.setDate(current.getDate() + 7 * interval);
    } else if (recurrence === 'monthly') {
        current.setMonth(current.getMonth() + interval);
    }
}

/**
 * Génère les prochaines dates d'occurrence d'une action à partir d'une date de départ.
 * @param {Object} params
 * @param {Object} params.action   - Action (date, recurrence, recurrenceInterval, …)
 * @param {Date}   params.fromDate - Date de début (incluse)
 * @param {number} params.max      - Nombre max d'occurrences à générer
 * @returns {string[]} Tableau de dates YYYY-MM-DD triées
 */
function generateOccurrences({ action, fromDate, max = 30 }) {
    const actionDateStr = action.date;
    if (!actionDateStr) return [];

    const recurrence = action.recurrence || 'none';
    const interval = Math.max(1, parseInt(action.recurrenceInterval) || 1);
    const endDateStr = action.recurrenceEndDate || null;

    // Action ponctuelle
    if (recurrence === 'none') {
        const fromStr = formatDateStr(fromDate);
        return actionDateStr >= fromStr ? [actionDateStr] : [];
    }

    const fromStr = formatDateStr(fromDate);
    const results = [];

    // Partir de la date de l'action et avancer jusqu'à fromDate
    const current = new Date(`${actionDateStr}T12:00:00`);
    let safety = 0;
    while (formatDateStr(current) < fromStr && safety < 50000) {
        advanceDate({ current, recurrence, interval });
        safety++;
    }

    let count = 0;
    while (count < max) {
        const dateStr = formatDateStr(current);
        if (endDateStr && dateStr > endDateStr) break;

        // Récurrence hebdomadaire avec jours spécifiques
        if (recurrence === 'weekly' && action.recurrenceDays?.length > 0) {
            const weekDays = action.recurrenceDays.map(Number);
            for (let d = 0; d < 7 && count < max; d++) {
                const day = new Date(current);
                day.setDate(current.getDate() + d);
                const dayStr = formatDateStr(day);
                if (dayStr < fromStr) continue;
                if (endDateStr && dayStr > endDateStr) break;
                if (weekDays.includes(day.getDay())) {
                    results.push(dayStr);
                    count++;
                }
            }
            advanceDate({ current, recurrence, interval });
        } else {
            results.push(dateStr);
            count++;
            advanceDate({ current, recurrence, interval });
        }
    }

    return results.sort();
}

// ---------- Résolution du statut d'une action ----------

/**
 * Détermine si une action est due ou en retard aujourd'hui.
 * @param {Object} params
 * @param {Object} params.action      - Action (champs date, recurrence, windowDays, states…)
 * @param {Array}  params.actionLogs  - Logs filtrés pour cette action
 * @param {string} params.todayStr    - Date du jour YYYY-MM-DD
 * @returns {{ due: boolean, status: 'overdue'|'due'|'ok', nextDate: string|null }}
 */
function resolveActionStatus({ action, actionLogs, todayStr }) {
    const states = action.states || [];
    const maxState = states.length > 0 ? states.length + 1 : 1;

    // Logs de type "done" complètement réalisés
    const fullDoneLogs = actionLogs
        .filter(l => {
            if (l.type && l.type !== 'done') return false;
            if (l.state == null) return true;
            return l.state === maxState;
        })
        .sort((a, b) => {
            const da = a.occurrenceDate || a.date;
            const db = b.occurrenceDate || b.date;
            return db.localeCompare(da);
        });

    const lastLog = fullDoneLogs.length > 0 ? fullDoneLogs[0] : null;

    const fromDate = lastLog
        ? new Date(`${lastLog.date}T12:00:00`)
        : new Date(`${action.date || todayStr}T12:00:00`);

    const occurrences = generateOccurrences({ action, fromDate });

    // Première occurrence non terminée après le dernier log
    let nextDate = null;
    if (lastLog) {
        const lastLogOccDate = lastLog.occurrenceDate || lastLog.date;
        nextDate = occurrences.find(d => d > lastLogOccDate)
            || occurrences.find(d => d >= todayStr)
            || null;
    } else {
        nextDate = occurrences.length > 0 ? occurrences[0] : null;
    }

    if (!nextDate) return { due: false, status: 'ok', nextDate: null };

    const windowDays = Math.max(0, parseInt(action.windowDays) || 0);
    const nextDateObj = new Date(`${nextDate}T12:00:00`);
    const windowStart = new Date(nextDateObj);
    windowStart.setDate(windowStart.getDate() - windowDays);
    const windowStartStr = formatDateStr(windowStart);

    let status;
    if (todayStr > nextDate) {
        status = 'overdue';
    } else if (todayStr >= windowStartStr) {
        status = 'due';
    } else {
        status = 'ok';
    }

    return { due: status !== 'ok', status, nextDate };
}

// ---------- Scheduler ----------

class ActionNotificationScheduler {
    /**
     * @param {Object} params
     * @param {import('./CollectiveService')} params.collectiveService
     * @param {import('./DataService')}       params.dataService
     */
    constructor({ collectiveService, dataService }) {
        this.collectiveService = collectiveService;
        this.dataService = dataService;
        // Déduplication : Set de "collectiveId:actionId:nextDate" envoyés aujourd'hui
        this._sentToday = new Set();
        this._lastSentDate = null;
    }

    /**
     * Démarre le scheduler.
     * Premier check 30 s après le démarrage, puis toutes les heures.
     */
    start() {
        const run = () => this.checkAndNotify().catch(
            err => console.error('[HA Scheduler] Erreur :', err)
        );
        setTimeout(run, 30_000);
        setInterval(run, 60 * 60 * 1000);
        console.log('[HA Scheduler] Démarré (1er check dans 30 s)');
    }

    /**
     * Réinitialise la déduplication si le jour a changé.
     * @param {string} todayStr
     */
    _resetIfNewDay(todayStr) {
        if (this._lastSentDate !== todayStr) {
            this._sentToday.clear();
            this._lastSentDate = todayStr;
        }
    }

    /**
     * Vérifie toutes les actions de tous les collectifs et envoie les notifications dues.
     */
    async checkAndNotify() {
        const todayStr = formatDateStr(new Date());
        this._resetIfNewDay(todayStr);

        const collectives = await this.collectiveService.getAll();

        for (const collective of collectives) {
            try {
                await this._checkCollective({ collective, todayStr });
            } catch (err) {
                console.error(
                    `[HA Scheduler] Erreur collectif ${collective.id} :`, err
                );
            }
        }
    }

    /**
     * Vérifie les actions d'un collectif et notifie les membres concernés.
     * @param {Object} params
     * @param {Object} params.collective
     * @param {string} params.todayStr
     */
    async _checkCollective({ collective, todayStr }) {
        const [actions, members, actionLogs] = await Promise.all([
            this.dataService.list({
                collectiveId: collective.id, collection: 'actions'
            }),
            this.dataService.list({
                collectiveId: collective.id, collection: 'members'
            }),
            this.dataService.list({
                collectiveId: collective.id, collection: 'action-logs'
            })
        ]);

        const membersMap = Object.fromEntries(members.map(m => [m.id, m]));

        for (const action of actions) {
            const logsForAction = actionLogs.filter(
                l => l.programmeId === action.id
            );
            const { due, status, nextDate } = resolveActionStatus({
                action, actionLogs: logsForAction, todayStr
            });

            if (!due) continue;

            const dedupeKey = `${collective.id}:${action.id}:${nextDate}`;
            if (this._sentToday.has(dedupeKey)) continue;

            const membersToNotify = this._getMembersToNotify({
                action, membersMap
            });

            for (const member of membersToNotify) {
                const webhookUrl = this._buildWebhookUrl(member);
                if (!webhookUrl) continue;

                try {
                    await NotificationService.send({
                        webhookUrl,
                        payload: {
                            action: action.name,
                            status,
                            date: nextDate,
                            collective: collective.label || collective.name,
                            collectiveId: collective.id,
                            description: action.description || ''
                        }
                    });
                    console.log(
                        `[HA Scheduler] Notifié membre ${member.id}`
                        + ` — "${action.name}" (${status}, ${nextDate})`
                    );
                } catch (err) {
                    console.error(
                        `[HA Scheduler] Échec membre ${member.id}`
                        + ` — "${action.name}" : ${err.message}`
                    );
                }
            }

            this._sentToday.add(dedupeKey);
        }
    }

    /**
     * Retourne la liste des membres à notifier pour une action.
     * Si l'action a un memberId, ne notifie que ce membre.
     * Sinon, notifie tous les membres ayant configuré haWebhookUrl.
     * @param {Object} params
     * @param {Object} params.action
     * @param {Object} params.membersMap - { memberId: member }
     * @returns {Array}
     */
    _getMembersToNotify({ action, membersMap }) {
        if (action.memberId && membersMap[action.memberId]) {
            return [membersMap[action.memberId]];
        }
        return Object.values(membersMap).filter(
            m => this._buildWebhookUrl(m)
        );
    }

    /**
     * Construit l'URL complète du webhook HA depuis les champs du membre.
     * Supporte haBaseUrl + haWebhookId ou l'ancien champ haWebhookUrl.
     * @param {Object} member
     * @returns {string|null}
     */
    _buildWebhookUrl(member) {
        if (member.haBaseUrl && member.haWebhookId) {
            const base = member.haBaseUrl.replace(/\/$/, '');
            return `${base}/api/webhook/${member.haWebhookId}`;
        }
        // Compatibilité avec l'ancien champ haWebhookUrl
        return member.haWebhookUrl || null;
    }
}

module.exports = ActionNotificationScheduler;
