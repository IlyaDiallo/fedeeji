const EventService = require('./EventService');
const Utils = require('../../frontend/js/InscriptionUtils');
const invalid = message => Object.assign(new Error(message), { status: 400 });

class InscriptionService {
    constructor({ dataService, eventService, today = () => Utils.today() }) {
        Object.assign(this, { dataService, eventService, today });
    }
    async context(collectiveId, eventId, memberId) {
        if (typeof eventId !== 'string' || !eventId || typeof memberId !== 'string' || !memberId) {
            throw invalid('eventId et memberId requis');
        }
        const event = await this.dataService.get({ collectiveId, collection: 'events', id: eventId });
        if (!event || event.type === 'individual') throw invalid('Événement collectif requis');
        const member = await this.dataService.get({ collectiveId, collection: 'members', id: memberId });
        if (!member) throw invalid('Membre du collectif requis');
        return event;
    }
    async setSeries(collectiveId, { eventId, memberId, active }) {
        if (typeof active !== 'boolean' || !eventId || !memberId) throw invalid('eventId, memberId et active requis');
        return this.eventService.locked(collectiveId, eventId, async () => {
            const event = await this.context(collectiveId, eventId, memberId);
            const today = this.today();
            if (!Utils.isRecurrent(event)) throw invalid('Événement récurrent requis');
            if (active && event.recurrenceEndDate && event.recurrenceEndDate < today) throw invalid('Série terminée');
            const params = { collectiveId, collection: 'inscriptions' };
            const records = await this.dataService.list(params);
            const existing = records.find(i => i.scope === 'series' && i.eventId === eventId && i.memberId === memberId);
            const periods = structuredClone(existing?.periods || []);
            const open = periods.find(p => !p.endsBefore);
            if (active && !open) periods.push({ startsOn: today, endsBefore: null });
            if (!active && open) open.endsBefore = today;
            const data = { scope: 'series', eventId, memberId, periods };
            if (existing) return this.dataService.update({ ...params, id: existing.id, data });
            if (!active) return null;
            return this.dataService.create({ ...params, data });
        });
    }
    validateEntry(event, entry, user) {
        const date = entry.occurrenceDate || event.date;
        if (!['yes', 'no', 'maybe', null].includes(entry.response)) throw invalid('Réponse invalide');
        if (!EventService.occurrence(event, date)) throw invalid('Occurrence invalide ou annulée');
        if (user.role === 'member' && date < this.today()) {
            throw Object.assign(new Error('past_event_locked'), { status: 403 });
        }
        return date;
    }
}
module.exports = InscriptionService;
