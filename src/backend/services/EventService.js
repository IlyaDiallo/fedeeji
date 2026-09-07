const crypto = require('crypto');
const { invalid, MAX_DELAY_MINUTES } = require('./NotificationConfig');
const RecurrenceUtils = require('../../frontend/js/RecurrenceUtils');

class EventService {
    constructor({ dataService }) {
        this.dataService = dataService;
        this.locks = new Map();
    }

    async locked(collectiveId, id, task) {
        const key = JSON.stringify([collectiveId, id]);
        const previous = this.locks.get(key) || Promise.resolve();
        const pending = previous.catch(() => {}).then(task);
        this.locks.set(key, pending);
        try { return await pending; }
        finally { if (this.locks.get(key) === pending) this.locks.delete(key); }
    }

    static visible(event, user) {
        return user.role !== 'member' || event.type !== 'individual' || event.memberId === user.memberId;
    }

    static occurrence(event, date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
        return RecurrenceUtils.generateOccurrences({ event, startDate: new Date(`${date}T12:00:00`) })
            .some(o => o.occurrenceDate === date && !o.isCancelled);
    }

    async normalize(collectiveId, input) {
        const type = input.type ?? 'collective';
        if (!['collective', 'individual'].includes(type)) throw invalid('Type d’événement invalide');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')
            || !Number.isFinite(Date.parse(input.date))
            || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw invalid('Date invalide');
        if (input.recurrenceInterval != null && (!Number.isSafeInteger(input.recurrenceInterval) || input.recurrenceInterval < 1)) {
            throw invalid('Intervalle de récurrence invalide');
        }
        if (input.recurrence && !['none', 'daily', 'weekly', 'biweekly', 'monthly'].includes(input.recurrence)) {
            throw invalid('Récurrence invalide');
        }
        if (input.recurrenceDays != null && (!Array.isArray(input.recurrenceDays)
            || input.recurrenceDays.some(d => !Number.isInteger(d) || d < 0 || d > 6))) {
            throw invalid('Jours de récurrence invalides');
        }
        const validDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
            && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
        if (input.recurrenceEndDate && (!validDate(input.recurrenceEndDate) || input.recurrenceEndDate < input.date)) {
            throw invalid('Fin de récurrence invalide');
        }
        if (input.cancelledDates != null && (!Array.isArray(input.cancelledDates) || input.cancelledDates.some(d => !validDate(d)))) {
            throw invalid('Dates annulées invalides');
        }
        let memberId = null;
        if (type === 'individual') {
            const members = await this.dataService.list({ collectiveId, collection: 'members' });
            if (typeof input.memberId !== 'string' || !members.some(m => m.id === input.memberId)) {
                throw invalid('Un utilisateur du collectif est requis');
            }
            memberId = input.memberId;
        }
        const value = input.reminder ?? { mode: 'none' };
        if (!value || !['none', 'notification', 'alert'].includes(value.mode)) throw invalid('Mode de rappel invalide');
        let reminder = { mode: 'none' };
        if (value.mode !== 'none') {
            if (!Number.isSafeInteger(value.advanceMinutes) || value.advanceMinutes < 0 || value.advanceMinutes > MAX_DELAY_MINUTES) {
                throw invalid('Délai attendu : de 0 à 527040 minutes');
            }
            if (input.allDay === true || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) {
                throw invalid('Une heure est nécessaire pour configurer un rappel');
            }
            reminder = { mode: value.mode, advanceMinutes: value.advanceMinutes };
        }
        return { ...input, type, memberId, reminder };
    }

    async save(collectiveId, id, input) {
        return this.locked(collectiveId, id || 'new', async () => {
            const previous = id ? await this.dataService.get({ collectiveId, collection: 'events', id }) : null;
            if (id && !previous) throw Object.assign(new Error('Non trouvé'), { status: 404 });
            const data = await this.normalize(collectiveId, { ...previous, ...input });
            if (data.type === 'individual' && previous && previous.type !== 'individual') {
                const inscriptions = await this.dataService.list({ collectiveId, collection: 'inscriptions' });
                if (inscriptions.some(i => i.eventId === id)) throw invalid('Supprimez les inscriptions avant de convertir cet événement en individuel');
            }
            // A schedule/recipient change invalidates old buttons without rearming on a description edit.
            const signature = e => JSON.stringify([e?.type, e?.memberId, e?.date, e?.time, e?.allDay,
                e?.recurrence, e?.recurrenceInterval, e?.recurrenceDays, e?.monthlyType,
                e?.recurrenceEndDate, e?.cancelledDates, e?.reminder]);
            data.reminderRevision = previous && signature(previous) === signature(data)
                ? previous.reminderRevision : crypto.randomUUID();
            return id ? this.dataService.update({ collectiveId, collection: 'events', id, data })
                : this.dataService.create({ collectiveId, collection: 'events', data });
        });
    }
}
module.exports = EventService;
