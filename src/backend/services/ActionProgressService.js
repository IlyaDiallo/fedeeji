const crypto = require('crypto');
const RecurrenceUtils = require('../../frontend/js/RecurrenceUtils');
const { recipientIds } = require('./NotificationConfig');

class ActionProgressService {
    constructor({ dataService, notificationState, now = () => Date.now() }) {
        this.dataService = dataService;
        this.notificationState = notificationState;
        this.now = now;
        this.locks = new Map();
    }

    async locked(collectiveId, actionId, fn) {
        const key = JSON.stringify([collectiveId, actionId]);
        const prior = this.locks.get(key) || Promise.resolve();
        const pending = prior.catch(() => {}).then(fn);
        this.locks.set(key, pending);
        try { return await pending; }
        finally { if (this.locks.get(key) === pending) this.locks.delete(key); }
    }

    static validDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(`${value}T12:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }

    static isOccurrence(action, date) {
        if (!this.validDate(date) || !this.validDate(action.date)) return false;
        if (action.cancelledDates?.includes(date)) return false;
        if (action.recurrenceEndDate && date > action.recurrenceEndDate) return false;
        if (action.recurrenceInterval != null && !(Number(action.recurrenceInterval) > 0)) return false;
        return RecurrenceUtils.generateOccurrences({
            event: action, startDate: new Date(`${date}T12:00:00`), maxOccurrences: 1000
        }).some(o => o.occurrenceDate === date && !o.isCancelled);
    }

    static context(action, logs, occurrenceDate) {
        const maxState = (action.states?.length || 0) + 1;
        const matching = logs.filter(l => l.programmeId === action.id
            && (!l.type || l.type === 'done') && (l.occurrenceDate || l.date) === occurrenceDate)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.state || 0) - (a.state || 0));
        const latest = matching[0] || null;
        const state = latest ? (latest.state == null ? maxState : latest.state) : 0;
        const revision = crypto.createHash('sha256').update(JSON.stringify({
            date: action.date, recurrence: action.recurrence, interval: action.recurrenceInterval,
            days: action.recurrenceDays, end: action.recurrenceEndDate,
            monthlyType: action.monthlyType, cancelledDates: action.cancelledDates,
            states: action.states, alert: action.alert, memberId: action.memberId,
            latest: latest && [latest.id, latest.timestamp, latest.state]
        })).digest('hex');
        return { maxState, state, latest, revision };
    }

    async load(collectiveId, actionId, occurrenceDate) {
        const action = await this.dataService.get({ collectiveId, collection: 'actions', id: actionId });
        if (!action) throw new Error('Action introuvable');
        const logs = await this.dataService.list({ collectiveId, collection: 'action-logs' });
        return { action, logs, ...ActionProgressService.context(action, logs, occurrenceDate) };
    }

    async create({ collectiveId, data, capability }) {
        return this.locked(collectiveId, data.programmeId, async () => {
            const occurrenceDate = data.occurrenceDate || data.date;
            const context = await this.load(collectiveId, data.programmeId, occurrenceDate);
            const { action, state, maxState, revision, latest } = context;
            if (!ActionProgressService.isOccurrence(action, occurrenceDate)) throw new Error('Occurrence invalide');
            if (!ActionProgressService.validDate(data.date)) throw new Error('Date de réalisation invalide');
            const target = data.state == null ? maxState : data.state;
            if (!Number.isInteger(target) || target < 0 || target > maxState) throw new Error('Étape invalide');
            if (capability) {
                const currentToken = await this.notificationState.resolveToken(collectiveId, capability.token);
                if (!currentToken || currentToken.revision !== revision || !action.alert?.enabled
                    || currentToken.actionId !== action.id || currentToken.occurrenceDate !== occurrenceDate
                    || currentToken.step !== target || currentToken.memberId !== data.memberId
                    || !recipientIds(action).includes(data.memberId) || target !== state + 1) {
                    throw new Error('Bouton expiré ou étape déjà validée');
                }
                const member = await this.dataService.get({ collectiveId, collection: 'members', id: data.memberId });
                if (!member) throw new Error('Destinataire introuvable');
            }
            if (state === target) return { data: latest, duplicate: true };
            if (action.alert?.enabled && target !== state + 1 && target !== 0) {
                throw new Error('Valider l’étape suivante uniquement');
            }
            const timestamp = Math.max(this.now(), (latest?.timestamp || 0) + 1);
            const created = await this.dataService.create({ collectiveId, collection: 'action-logs', data: {
                ...data, type: 'done', occurrenceDate, state: target, timestamp
            } });
            await this.notificationState.revokeTokens(collectiveId, { actionId: action.id, occurrenceDate });
            return { data: created, duplicate: false };
        });
    }

    async change({ collectiveId, id, data, remove = false }) {
        const original = await this.dataService.get({ collectiveId, collection: 'action-logs', id });
        if (!original) throw new Error('Réalisation introuvable');
        return this.locked(collectiveId, original.programmeId, async () => {
            const current = await this.dataService.get({ collectiveId, collection: 'action-logs', id });
            if (!current) throw new Error('Réalisation introuvable');
            let progressionChanged = remove && (!current.type || current.type === 'done');
            if (remove) {
                await this.dataService.delete({ collectiveId, collection: 'action-logs', id });
            } else {
                const merged = { ...current, ...data };
                // Editing notes/duration is allowed; do not move a realization to another action.
                if (merged.programmeId !== current.programmeId || merged.memberId !== current.memberId) {
                    throw new Error('Action et auteur de la réalisation non modifiables');
                }
                if (!merged.type || merged.type === 'done') {
                    const occ = merged.occurrenceDate || merged.date;
                    const { action, maxState } = await this.load(collectiveId, current.programmeId, occ);
                    if (!ActionProgressService.isOccurrence(action, occ) || !ActionProgressService.validDate(merged.date)
                        || (merged.state != null && (!Number.isInteger(merged.state) || merged.state < 0 || merged.state > maxState))) {
                        throw new Error('Réalisation invalide');
                    }
                }
                progressionChanged = ['state', 'occurrenceDate', 'date', 'type'].some(key => merged[key] !== current[key]);
                data = await this.dataService.update({ collectiveId, collection: 'action-logs', id,
                    data: { ...merged, timestamp: progressionChanged
                        ? Math.max(this.now(), (current.timestamp || 0) + 1) : current.timestamp } });
            }
            if (progressionChanged) await this.notificationState.revokeTokens(collectiveId, { actionId: current.programmeId });
            return data;
        });
    }
}

module.exports = ActionProgressService;
