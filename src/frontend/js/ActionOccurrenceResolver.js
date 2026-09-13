/**
 * Résolution des occurrences d'actions récurrentes.
 * Centralise la logique dupliquée entre renderList et renderCalendar.
 */
class ActionOccurrenceResolver {

    /**
     * Prépare les logs triés et le maxState pour une action donnée.
     * @param {Object} params
     * @param {Object} params.action - Action normalisée
     * @param {Array}  params.actionLogs - Tous les logs du collectif
     * @returns {{ logs, allDoneLogs, fullDoneLogs, lastLog, maxState }}
     */
    static prepareLogContext({ action, actionLogs }) {
        const logs = actionLogs
            .filter(l => l.programmeId === action.id)
            .sort((a, b) => {
                const da = a.occurrenceDate || a.date;
                const db = b.occurrenceDate || b.date;
                return db.localeCompare(da);
            });

        const allDoneLogs = logs.filter(l => !l.type || l.type === 'done');
        const maxState = (action.states?.length > 0)
            ? action.states.length + 1 : 1;

        const fullDoneLogs = allDoneLogs.filter(l => {
            // Ancien log sans état : considéré comme complètement fait
            if (l.state == null) return true;
            return l.state === maxState;
        }).filter(l => ActionOccurrenceResolver.computeCurrentState({
            allDoneLogs, occDateStr: l.occurrenceDate || l.date, maxState
        }) === maxState);

        const lastLog = fullDoneLogs.length > 0 ? fullDoneLogs[0] : null;

        // Une réalisation solde aussi les échéances antérieures, même si elle
        // est enregistrée en retard pour une ancienne occurrence.
        const completedThrough = fullDoneLogs.reduce((latest, log) =>
            [latest, log.occurrenceDate || log.date, log.date].filter(Boolean).sort().at(-1), null);

        return { logs, allDoneLogs, fullDoneLogs, lastLog, maxState, completedThrough };
    }

    /**
     * Calcule l'état courant d'une occurrence à partir des logs "done".
     * @param {Object} params
     * @param {Array}  params.allDoneLogs - Logs "done" de cette action
     * @param {string} params.occDateStr  - Date de l'occurrence (YYYY-MM-DD)
     * @param {number} params.maxState    - Nombre d'états + 1
     * @returns {number} État courant (0 = à faire, maxState = fait)
     */
    static computeCurrentState({ allDoneLogs, occDateStr, maxState }) {
        const occDoneLogs = allDoneLogs
            .filter(l => (l.occurrenceDate || l.date) === occDateStr)
            .sort((a, b) =>
                (b.timestamp || 0) - (a.timestamp || 0)
                || (b.state || 0) - (a.state || 0)
            );
        const latestStateLog = occDoneLogs.length > 0
            ? occDoneLogs[0] : null;
        return latestStateLog
            ? (latestStateLog.state == null ? maxState : latestStateLog.state)
            : 0;
    }

    /**
     * Détermine le statut d'une occurrence par rapport à aujourd'hui.
     * @param {Object} params
     * @param {string} params.todayStr   - Date du jour (YYYY-MM-DD)
     * @param {string} params.occDateStr - Date de l'occurrence
     * @param {number} params.windowDays - Jours avant la date limite
     * @returns {'overdue'|'due'|'ok'}
     */
    static computeStatus({ todayStr, occDateStr, windowDays }) {
        const occDateObj = new Date(`${occDateStr}T12:00:00`);
        const windowStartObj = new Date(occDateObj);
        windowStartObj.setDate(windowStartObj.getDate() - (windowDays || 0));
        const windowStartStr = RecurrenceUtils.formatDateStr(windowStartObj);

        if (todayStr > occDateStr) return 'overdue';
        if (todayStr >= windowStartStr) return 'due';
        return 'ok';
    }

    /**
     * Calcule le windowStartStr pour une occurrence donnée.
     * @param {Object} params
     * @param {string} params.occDateStr - Date de l'occurrence
     * @param {number} params.windowDays - Jours avant la date limite
     * @returns {string} Date de début de fenêtre (YYYY-MM-DD)
     */
    static computeWindowStart({ occDateStr, windowDays }) {
        const occDateObj = new Date(`${occDateStr}T12:00:00`);
        const windowStartObj = new Date(occDateObj);
        windowStartObj.setDate(windowStartObj.getDate() - (windowDays || 0));
        return RecurrenceUtils.formatDateStr(windowStartObj);
    }

    /**
     * Résout la prochaine occurrence d'une action pour la vue liste.
     * @param {Object} params
     * @param {Object} params.action     - Action normalisée
     * @param {Array}  params.actionLogs - Tous les logs
     * @param {string} params.todayStr   - Date du jour (YYYY-MM-DD)
     * @returns {Object|null} Item enrichi prêt à afficher, ou null
     */
    static resolveNextOccurrence({ action, actionLogs, todayStr, excludeCancelled = false }) {
        const { logs, allDoneLogs, lastLog, maxState, completedThrough } =
            ActionOccurrenceResolver.prepareLogContext({ action, actionLogs });

        const generateFrom = completedThrough || action.date || todayStr;

        const occurrences = (window.RecurrenceUtils
            ? RecurrenceUtils.generateOccurrences({
                event: action,
                startDate: new Date(`${generateFrom}T12:00:00`)
            }) : [action]).filter(occ => !excludeCancelled || !occ.isCancelled);

        // Chercher la prochaine occurrence non terminée
        const targetOccurrence = occurrences.find(o =>
            !completedThrough || o.occurrenceDate > completedThrough);

        if (!targetOccurrence) return null;

        const occDateStr = targetOccurrence.occurrenceDate;
        const targetNotes = logs.filter(
            l => l.type === 'note' && l.date === occDateStr
        );

        const status = ActionOccurrenceResolver.computeStatus({
            todayStr, occDateStr, windowDays: action.windowDays
        });
        const windowStartStr = ActionOccurrenceResolver.computeWindowStart({
            occDateStr, windowDays: action.windowDays
        });
        const currentState = ActionOccurrenceResolver.computeCurrentState({
            allDoneLogs, occDateStr, maxState
        });

        return {
            type: 'action',
            data: action,
            nextDate: occDateStr,
            occurrence: targetOccurrence,
            status,
            lastLog,
            targetNotes,
            currentState,
            windowStartStr
        };
    }

    /**
     * Résout toutes les occurrences d'une action dans un intervalle (vue calendrier).
     * @param {Object} params
     * @param {Object} params.action     - Action normalisée
     * @param {Array}  params.actionLogs - Tous les logs
     * @param {string} params.startStr   - Début de l'intervalle (YYYY-MM-DD)
     * @param {string} params.endStr     - Fin de l'intervalle (YYYY-MM-DD)
     * @returns {Array} Items enrichis prêts à afficher
     */
    static resolveOccurrencesInRange({ action, actionLogs, startStr, endStr }) {
        const { logs, allDoneLogs, lastLog, maxState, completedThrough } =
            ActionOccurrenceResolver.prepareLogContext({ action, actionLogs });

        const generateFrom = startStr;

        const occurrences = window.RecurrenceUtils
            ? RecurrenceUtils.generateOccurrences({
                event: action,
                startDate: new Date(`${generateFrom}T12:00:00`),
                maxOccurrences: 200
            }) : [action];

        const results = [];
        occurrences.forEach(occ => {
            if (occ.occurrenceDate >= startStr && occ.occurrenceDate <= endStr) {
                const occDateStr = occ.occurrenceDate;
                const targetNotes = logs.filter(
                    l => l.type === 'note' && l.date === occDateStr
                );
                const currentState = ActionOccurrenceResolver.computeCurrentState({
                    allDoneLogs, occDateStr, maxState
                });
                const isDone = currentState === maxState;
                // Ne pas proposer de rattrapage des anciennes instances ;
                // conserver les réalisations dans le calendrier.
                if (!isDone && completedThrough && occDateStr <= completedThrough) return;

                results.push({
                    type: 'action',
                    data: action,
                    date: occDateStr,
                    occurrence: occ,
                    lastLog,
                    targetNotes,
                    currentState,
                    isDone
                });
            }
        });

        return results;
    }
}
