const crypto = require('crypto');
const NotificationService = require('./NotificationService');
const NotificationStateService = require('./NotificationStateService');
const ActionProgressService = require('./ActionProgressService');
const RecurrenceUtils = require('../../frontend/js/RecurrenceUtils');
const { recipientIds, buildWebhookUrl, REPEAT_MS } = require('./NotificationConfig');

function localClock(timestamp, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(timestamp));
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
function isQuiet(time, { quietStart, quietEnd }) {
    return quietStart < quietEnd ? time >= quietStart && time < quietEnd
        : time >= quietStart || time < quietEnd;
}
function nextOccurrence(action, logs) {
    if (!ActionProgressService.validDate(action.date)) return null;
    if (action.recurrenceInterval != null && !(Number(action.recurrenceInterval) > 0)) return null;
    const maxState = (action.states?.length || 0) + 1;
    const loggedDates = [...new Set(logs.filter(l => l.programmeId === action.id)
        .map(l => l.occurrenceDate || l.date))];
    const completed = loggedDates.filter(date =>
        ActionProgressService.context(action, logs, date).state === maxState).sort().at(-1);
    const from = completed || action.date;
    return RecurrenceUtils.generateOccurrences({
        event: action, startDate: new Date(`${from}T12:00:00`), maxOccurrences: 1000
    }).find(o => !o.isCancelled && (!completed || o.occurrenceDate > completed))?.occurrenceDate || null;
}

class ActionNotificationScheduler {
    constructor({ collectiveService, dataService, notificationState, progressService,
        now = () => Date.now(), send = params => NotificationService.send(params) }) {
        Object.assign(this, { collectiveService, dataService, notificationState, progressService, now, send });
        this.running = null;
    }
    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.checkAndNotify().catch(() => {
            console.error('[HA Scheduler] Échec du contrôle');
        }), 30000);
    }
    stop() { clearInterval(this.timer); this.timer = null; }

    async checkAndNotify(collectiveId) {
        if (this.running) return this.running;
        this.running = this._check(collectiveId);
        try { return await this.running; }
        finally { this.running = null; }
    }

    async _check(collectiveId) {
        const collectives = await this.collectiveService.getAll();
        for (const collective of collectives.filter(c => !collectiveId || c.id === collectiveId)) {
            try { await this._checkCollective(collective); }
            catch { console.error(`[HA Scheduler] Échec collectif ${collective.id}`); }
        }
    }

    async _checkCollective(collective) {
        const collectiveId = collective.id;
        const settings = await this.notificationState.getSettings(collectiveId);
        if (!settings) return;
        const actions = await this.dataService.list({ collectiveId, collection: 'actions' });
        const members = await this.dataService.list({ collectiveId, collection: 'members' });
        const deliveries = await this.notificationState.listDeliveries(collectiveId);
        const retained = new Set();
        for (const initialAction of actions) {
            await this.progressService.locked(collectiveId, initialAction.id, async () => {
                const action = await this.dataService.get({ collectiveId, collection: 'actions', id: initialAction.id });
                if (!action?.alert?.enabled) return;
                const logs = await this.dataService.list({ collectiveId, collection: 'action-logs' });
                const occurrenceDate = nextOccurrence(action, logs);
                if (!occurrenceDate) return;
                const { state, maxState, latest, revision } = ActionProgressService.context(action, logs, occurrenceDate);
                if (state >= maxState) return;
                const step = state + 1;
                const timestamp = this.now();
                const clock = localClock(timestamp, settings.timeZone);
                const due = state === 0
                    ? `${clock.date}T${clock.time}` >= `${occurrenceDate}T${action.alert.initialTime}`
                    : Number.isFinite(latest?.timestamp) && timestamp >= latest.timestamp + action.alert.stepDelayMinutes[state - 1] * 60000;
                for (const memberId of recipientIds(action)) {
                    const member = members.find(m => m.id === memberId);
                    const webhookUrl = buildWebhookUrl(member);
                    if (!webhookUrl) continue;
                    const identity = { actionId: action.id, occurrenceDate, step, memberId };
                    const id = NotificationStateService.deliveryId(identity);
                    const old = deliveries.find(d => d.id === id);
                    let delivery = old?.revision === revision ? old : {
                        ...identity, id, revision, failures: 0, nextAttemptAt: 0,
                        notificationId: crypto.createHash('sha256').update(JSON.stringify([collectiveId, action.id, occurrenceDate, step])).digest('hex')
                    };
                    retained.add(id);
                    // Once started, a fall-back DST clock must not pause the ten-minute cycle.
                    if ((!due && !delivery.lastSuccessAt) || isQuiet(clock.time, settings) || timestamp < (delivery.nextAttemptAt || 0)) continue;
                    const token = await this.notificationState.issueToken(collectiveId, { ...identity, revision });
                    delivery = { ...delivery, active: true, lastAttemptAt: timestamp };
                    // Persist before HTTP so a crash still leaves an alert that can be cleared.
                    await this.notificationState.saveDelivery(collectiveId, delivery);
                    try {
                        await this.send({ webhookUrl, settings, payload: {
                            version: 1, type: 'reminder', action: action.name,
                            status: clock.date > occurrenceDate ? 'overdue' : 'due', date: occurrenceDate,
                            collective: collective.label || collective.name, collectiveId,
                            description: action.description || '', notificationId: delivery.notificationId,
                            step, stepLabel: action.states?.[state] || 'Fait',
                            button: { title: 'Fait', action: `FEDDEEJI_${token}` }
                        } });
                        delivery.lastSuccessAt = this.now();
                        delivery.nextAttemptAt = this.now() + REPEAT_MS;
                        delivery.failures = 0;
                    } catch {
                        delivery.failures = (delivery.failures || 0) + 1;
                        delivery.nextAttemptAt = this.now() + Math.min(REPEAT_MS, 30000 * 2 ** Math.min(delivery.failures - 1, 5));
                    }
                    await this.notificationState.saveDelivery(collectiveId, delivery);
                }
            });
        }
        for (const delivery of deliveries) {
            if (retained.has(delivery.id) || !delivery.active) continue;
            await this.notificationState.revokeTokens(collectiveId, {
                actionId: delivery.actionId, occurrenceDate: delivery.occurrenceDate, step: delivery.step,
                memberId: delivery.memberId
            });
            if (delivery.clearRetryAt && this.now() < delivery.clearRetryAt) continue;
            const webhookUrl = buildWebhookUrl(members.find(m => m.id === delivery.memberId));
            try {
                if (webhookUrl) await this.send({ webhookUrl, settings, payload: {
                    version: 1, type: 'clear', collectiveId, notificationId: delivery.notificationId
                } });
                await this.notificationState.saveDelivery(collectiveId, { ...delivery, active: false });
            } catch {
                await this.notificationState.saveDelivery(collectiveId, { ...delivery, clearRetryAt: this.now() + REPEAT_MS });
            }
        }
        await this.notificationState.pruneTokens(collectiveId);
    }
}
ActionNotificationScheduler.localClock = localClock;
ActionNotificationScheduler.isQuiet = isQuiet;
ActionNotificationScheduler.nextOccurrence = nextOccurrence;
module.exports = ActionNotificationScheduler;
