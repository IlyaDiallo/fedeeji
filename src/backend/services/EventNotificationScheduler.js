const crypto = require('crypto');
const EventService = require('./EventService');
const NotificationService = require('./NotificationService');
const ActionNotificationScheduler = require('./ActionNotificationScheduler');
const RecurrenceUtils = require('../../frontend/js/RecurrenceUtils');
const { buildWebhookUrl, REPEAT_MS } = require('./NotificationConfig');
const { localClock, isQuiet } = ActionNotificationScheduler;
const DAY = 86400000;

// Resolve a local event time independently of the server's TZ. In an autumn overlap
// use the first instant; in a spring gap shift forward by the gap's duration.
function eventTimestamp(date, time, timeZone) {
    const wall = Date.parse(`${date}T${time}:00Z`);
    if (!Number.isFinite(wall)) return NaN;
    const candidates = [...new Set([-DAY, 0, DAY].map(delta => {
        const sample = wall + delta;
        const clock = localClock(sample, timeZone);
        const offset = Date.parse(`${clock.date}T${clock.time}:00Z`) - sample;
        return wall - offset;
    }))];
    const valid = candidates.filter(ts => {
        const clock = localClock(ts, timeZone);
        return clock.date === date && clock.time === time;
    });
    return valid.length ? Math.min(...valid) : Math.max(...candidates);
}

class EventNotificationScheduler {
    constructor({ collectiveService, dataService, notificationState, eventService,
        now = () => Date.now(), send = params => NotificationService.send(params) }) {
        Object.assign(this, { collectiveService, dataService, notificationState, eventService, now, send });
    }
    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.checkAndNotify().catch(() => console.error('[Event Scheduler] Échec')), 30000);
    }
    stop() { clearInterval(this.timer); this.timer = null; }
    async checkAndNotify(collectiveId) {
        if (this.running) return this.running;
        this.running = this.check(collectiveId);
        try { await this.running; } finally { this.running = null; }
    }
    async recipients(collectiveId, event, date) {
        if (event.type === 'individual') return [event.memberId];
        const inscriptions = await this.dataService.list({ collectiveId, collection: 'inscriptions' });
        return [...new Set(inscriptions.filter(i => i.eventId === event.id && i.response === 'yes'
            && (i.occurrenceDate || event.date) === date).map(i => i.memberId))];
    }
    async current(collectiveId, delivery) {
        const event = await this.dataService.get({ collectiveId, collection: 'events', id: delivery.eventId });
        if (!event || event.reminderRevision !== delivery.revision || event.reminder?.mode === 'none'
            || !EventService.occurrence(event, delivery.occurrenceDate)
            || !(await this.recipients(collectiveId, event, delivery.occurrenceDate)).includes(delivery.memberId)) return null;
        return event;
    }
    async check(onlyId) {
        for (const collective of await this.collectiveService.getAll()) {
            if (onlyId && collective.id !== onlyId) continue;
            try { await this.checkCollective(collective); }
            catch { console.error(`[Event Scheduler] Échec collectif ${collective.id}`); }
        }
    }
    async checkCollective(collective) {
        const collectiveId = collective.id;
        const state = this.notificationState;
        const settings = await state.getSettings(collectiveId);
        if (!settings) return;
        const timestamp = this.now();
        const from = (await state.getEventCursor(collectiveId)) ?? timestamp - 30000;
        const members = await this.dataService.list({ collectiveId, collection: 'members' });
        const deliveries = await state.listEventDeliveries(collectiveId);
        for (const initial of await this.dataService.list({ collectiveId, collection: 'events' })) {
            await this.eventService.locked(collectiveId, initial.id, async () => {
                const event = await this.dataService.get({ collectiveId, collection: 'events', id: initial.id });
                if (!['notification', 'alert'].includes(event?.reminder?.mode)) return;
                const advance = event.reminder.advanceMinutes * 60000;
                // Iterate yearly windows to also recover after a prolonged server shutdown.
                for (let window = from; window <= timestamp; window += 300 * DAY) {
                    const start = localClock(window + advance - DAY, settings.timeZone).date;
                    const occurrences = RecurrenceUtils.generateOccurrences({ event, startDate: new Date(`${start}T12:00:00`) });
                    for (const occurrence of occurrences) {
                        if (occurrence.isCancelled) continue;
                        const date = occurrence.occurrenceDate;
                        const dueAt = eventTimestamp(date, event.time, settings.timeZone) - advance;
                        if (!(dueAt >= from && dueAt <= timestamp)) continue;
                        for (const memberId of await this.recipients(collectiveId, event, date)) {
                            const id = 'event-delivery-' + crypto.createHash('sha256')
                                .update(JSON.stringify([event.id, date, memberId, event.reminderRevision])).digest('hex');
                            if (deliveries.some(d => d.id === id)) continue;
                            const delivery = { id, eventId: event.id, occurrenceDate: date, memberId,
                                revision: event.reminderRevision, mode: event.reminder.mode, dueAt, active: false };
                            await state.saveEventDelivery(collectiveId, delivery);
                            deliveries.push(delivery);
                        }
                    }
                }
            });
        }
        await state.saveEventCursor(collectiveId, timestamp);
        for (const initial of deliveries) {
            await this.eventService.locked(collectiveId, initial.eventId, async () => {
                const delivery = (await state.listEventDeliveries(collectiveId)).find(d => d.id === initial.id);
                const event = await this.current(collectiveId, delivery);
                const webhookUrl = buildWebhookUrl(members.find(m => m.id === delivery.memberId));
                if (!event || delivery.acknowledgedAt) {
                    if (!delivery.active || timestamp < (delivery.clearRetryAt || 0)) return;
                    try {
                        if (webhookUrl) await this.send({ webhookUrl, settings, payload: {
                            version: 1, type: 'clear', collectiveId, notificationId: delivery.id
                        } });
                        delivery.active = false;
                    } catch { delivery.clearRetryAt = timestamp + REPEAT_MS; }
                    await state.saveEventDelivery(collectiveId, delivery);
                    return;
                }
                if (delivery.mode === 'notification' && delivery.lastSuccessAt) return;
                if (!webhookUrl || timestamp < (delivery.nextAttemptAt || 0)
                    || isQuiet(localClock(timestamp, settings.timeZone).time, settings)) return;
                let button;
                if (delivery.mode === 'alert') {
                    const token = await state.issueToken(collectiveId, { eventId: event.id,
                        deliveryId: delivery.id, memberId: delivery.memberId, revision: delivery.revision });
                    button = { title: 'Acquitter', action: `FEDDEEJI_${token}` };
                }
                delivery.active = delivery.mode === 'alert';
                delivery.lastAttemptAt = timestamp;
                delivery.nextAttemptAt = timestamp + REPEAT_MS;
                await state.saveEventDelivery(collectiveId, delivery);
                try {
                    await this.send({ webhookUrl, settings, payload: {
                        version: 1, type: 'reminder', eventId: event.id, reminderMode: delivery.mode,
                        action: event.name, description: event.description || '', date: delivery.occurrenceDate,
                        time: event.time, collective: collective.label || collective.name, collectiveId,
                        notificationId: delivery.id, ...(button ? { button } : {})
                    } });
                    delivery.lastSuccessAt = this.now();
                    delivery.failures = 0;
                } catch {
                    delivery.failures = (delivery.failures || 0) + 1;
                    delivery.nextAttemptAt = timestamp + Math.min(REPEAT_MS, 30000 * 2 ** Math.min(delivery.failures - 1, 5));
                }
                await state.saveEventDelivery(collectiveId, delivery);
            });
        }
    }
    async active(collectiveId, user) {
        const result = [];
        for (const d of await this.notificationState.listEventDeliveries(collectiveId)) {
            if (d.mode !== 'alert' || d.acknowledgedAt || (user.role === 'member' && d.memberId !== user.memberId)) continue;
            const event = await this.current(collectiveId, d);
            if (event) result.push({ id: d.id, eventId: d.eventId, name: event.name,
                occurrenceDate: d.occurrenceDate, memberId: d.memberId });
        }
        return result;
    }
    async ack(collectiveId, deliveryId, user, eventId, capability) {
        if (typeof deliveryId !== 'string' || !/^event-delivery-[a-f0-9]{64}$/.test(deliveryId)) throw new Error('Alerte invalide');
        return this.eventService.locked(collectiveId, eventId, async () => {
            const d = (await this.notificationState.listEventDeliveries(collectiveId)).find(d => d.id === deliveryId);
            if (!d || d.eventId !== eventId || d.mode !== 'alert' || !await this.current(collectiveId, d)
                || (user?.role === 'member' && user.memberId !== d.memberId)
                || (!user && (!capability || capability.eventId !== d.eventId || capability.memberId !== d.memberId
                    || capability.revision !== d.revision || capability.deliveryId !== d.id))) throw new Error('Alerte inaccessible');
            await this.notificationState.saveEventDelivery(collectiveId, {
                ...d, acknowledgedAt: d.acknowledgedAt || this.now(), nextAttemptAt: 0
            });
        });
    }
}
EventNotificationScheduler.eventTimestamp = eventTimestamp;
module.exports = EventNotificationScheduler;
