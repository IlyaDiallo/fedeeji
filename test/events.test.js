const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
process.env.SUPERADMIN_PASSWORD = 'test-only-password';
process.env.JWT_SECRET = 'test-only-secret-not-for-production';
const EventService = require('../src/backend/services/EventService');
const Scheduler = require('../src/backend/services/EventNotificationScheduler');
const NotificationState = require('../src/backend/services/NotificationStateService');
const createEventsRouter = require('../src/backend/routes/events');
const createInscriptionsRouter = require('../src/backend/routes/inscriptions');
const createCallbacks = require('../src/backend/routes/notificationCallbacks');

function fixture() {
    const records = new Map();
    const storage = {
        async read({ collectiveId, collection, id }) {
            const items = records.get(`${collectiveId}/${collection}`) || [];
            return structuredClone(id ? items.find(i => i.id === id) || null : items);
        },
        async write({ collectiveId, collection, id, data }) {
            const key = `${collectiveId}/${collection}`;
            const items = records.get(key) || [];
            records.set(key, [...items.filter(i => i.id !== id), structuredClone(data)]);
        },
        async delete({ collectiveId, collection, id }) {
            const key = `${collectiveId}/${collection}`;
            records.set(key, (records.get(key) || []).filter(i => i.id !== id));
        }
    };
    const dataService = {
        list: p => storage.read(p), get: p => storage.read(p),
        async create(p) { const data = { ...p.data, id: p.data.id || require('crypto').randomUUID() }; await storage.write({ ...p, id: data.id, data }); return data; },
        async update(p) { const data = { ...await storage.read(p), ...p.data, id: p.id }; await storage.write({ ...p, data }); return data; },
        delete: p => storage.delete(p)
    };
    let timestamp = Date.parse('2026-06-01T07:30:00Z'); // 09:30 Paris
    const now = () => timestamp;
    const notificationState = new NotificationState({ storage, now });
    const eventService = new EventService({ dataService });
    const collectiveService = { async getAll() { return [{ id: 'demo', label: 'Demo' }]; } };
    const sends = [];
    const scheduler = new Scheduler({ collectiveService, dataService, notificationState, eventService, now,
        send: async p => { sends.push(p); } });
    return { storage, dataService, notificationState, eventService, collectiveService, scheduler, sends, now,
        setTime: value => { timestamp = Date.parse(value); },
        async setup(mode = 'alert', extra = {}) {
            await dataService.create({ collectiveId: 'demo', collection: 'members', data: { id: 'alice', haWebhookUrl: 'https://ha.example/api/webhook/alice' } });
            await dataService.create({ collectiveId: 'demo', collection: 'members', data: { id: 'bob', haWebhookUrl: 'https://ha.example/api/webhook/bob' } });
            await notificationState.setSettings('demo', { timeZone: 'Europe/Paris', quietStart: '22:00', quietEnd: '08:00', allowedOrigins: ['https://ha.example'] });
            return eventService.save('demo', null, { name: 'RDV', type: 'individual', memberId: 'alice', date: '2026-06-01',
                time: '10:00', allDay: false, reminder: { mode, advanceMinutes: 30 }, ...extra });
        }
    };
}

test('legacy events default to collective; individual association and reminders are validated', async () => {
    const f = fixture();
    const legacy = await f.eventService.save('demo', null, { name: 'Old', date: '2026-06-01' });
    assert.equal(legacy.type, 'collective');
    assert.deepEqual(legacy.reminder, { mode: 'none' });
    const event = await f.setup();
    for (const input of [{ type: 'bad' }, { memberId: 'outsider' }, { memberId: ['alice'] }, { allDay: true },
        { date: '2026-02-30' }, { reminder: { mode: 'alert', advanceMinutes: -1 } },
        { reminder: { mode: 'notification', advanceMinutes: 0.5 } }, { recurrenceInterval: -1 }]) {
        await assert.rejects(f.eventService.save('demo', event.id, input));
    }
    const edited = await f.eventService.save('demo', event.id, { description: 'Updated' });
    assert.equal(edited.reminderRevision, event.reminderRevision);
    const rescheduled = await f.eventService.save('demo', event.id, { time: '11:00' });
    assert.notEqual(rescheduled.reminderRevision, event.reminderRevision);
    await f.dataService.create({ collectiveId: 'demo', collection: 'inscriptions', data: { eventId: legacy.id, memberId: 'alice' } });
    await assert.rejects(f.eventService.save('demo', legacy.id, { type: 'individual', memberId: 'alice' }), /inscriptions/);
});

test('single notification triggers in advance once, including after scheduler restart', async () => {
    const f = fixture();
    await f.setup('notification');
    f.setTime('2026-06-01T07:29:00Z');
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 0);
    f.setTime('2026-06-01T07:30:00Z');
    await Promise.all([f.scheduler.checkAndNotify(), f.scheduler.checkAndNotify()]);
    assert.equal(f.sends.length, 1);
    assert.equal(f.sends[0].payload.button, undefined);
    assert.equal(f.sends[0].webhookUrl, 'https://ha.example/api/webhook/alice');
    f.setTime('2026-06-01T08:30:00Z');
    const restart = new Scheduler({ ...f, send: async p => f.sends.push(p) });
    await restart.checkAndNotify();
    assert.equal(f.sends.length, 1);
});

test('alerts repeat every ten minutes; scoped acknowledgement stops and clears them', async () => {
    const f = fixture();
    const event = await f.setup();
    await f.scheduler.checkAndNotify();
    const token = f.sends[0].payload.button.action.slice(9);
    const record = await f.notificationState.resolveToken('demo', token);
    assert.equal(record.eventId, event.id);
    assert.equal(await f.notificationState.resolveToken('other', token), null);
    f.setTime('2026-06-01T07:39:00Z');
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 1);
    f.setTime('2026-06-01T07:40:00Z');
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 2);
    assert.equal(f.sends[0].payload.notificationId, f.sends[1].payload.notificationId);
    assert.deepEqual(await f.scheduler.active('demo', { role: 'member', memberId: 'bob' }), []);
    const [active] = await f.scheduler.active('demo', { role: 'member', memberId: 'alice' });
    await assert.rejects(f.scheduler.ack('demo', active.id, { role: 'member', memberId: 'bob' }, event.id));
    await assert.rejects(f.scheduler.ack('demo', active.id, null, event.id));
    await f.scheduler.ack('demo', active.id, null, event.id, record);
    await f.scheduler.ack('demo', active.id, null, event.id, record); // idempotent
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.at(-1).payload.type, 'clear');
    f.setTime('2026-06-01T09:00:00Z');
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 3);
});

test('quiet hours defer delivery, transport failure retries, and a recurrence has its own acknowledgement', async () => {
    const f = fixture();
    await f.setup('alert', { time: '08:00', recurrence: 'weekly' });
    f.setTime('2026-06-01T05:30:00Z');
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 0);
    f.setTime('2026-06-01T06:00:00Z');
    let failures = 1;
    f.scheduler.send = async p => { if (failures-- > 0) throw Error('Offline'); f.sends.push(p); };
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 0);
    f.setTime('2026-06-01T06:00:30Z');
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 1);
    const [active] = await f.scheduler.active('demo', { role: 'admin' });
    await f.scheduler.ack('demo', active.id, { role: 'admin' }, active.eventId);
    f.setTime('2026-06-08T06:00:00Z');
    await f.scheduler.checkAndNotify();
    const reminders = f.sends.filter(p => p.payload.type === 'reminder');
    assert.equal(reminders.length, 2);
    assert.equal(reminders[1].payload.date, '2026-06-08');
    assert.notEqual(reminders[0].payload.notificationId, reminders[1].payload.notificationId);
});

test('collective reminders target only yes inscriptions for the occurrence; cancellation invalidates buttons', async () => {
    const f = fixture();
    const event = await f.setup('alert', { type: 'collective' });
    for (const [memberId, response, occurrenceDate] of [['alice', 'yes', '2026-06-01'], ['bob', 'no', '2026-06-01'], ['bob', 'yes', '2026-06-08']]) {
        await f.dataService.create({ collectiveId: 'demo', collection: 'inscriptions', data: { eventId: event.id, memberId, response, occurrenceDate } });
    }
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.length, 1);
    const record = await f.notificationState.resolveToken('demo', f.sends[0].payload.button.action.slice(9));
    await f.eventService.save('demo', event.id, { cancelledDates: ['2026-06-01'] });
    await assert.rejects(f.scheduler.ack('demo', record.deliveryId, null, event.id, record));
    f.setTime('2026-06-01T07:40:00Z');
    await f.scheduler.checkAndNotify();
    assert.equal(f.sends.at(-1).payload.type, 'clear');
});

test('advance crosses midnight and uses the collective timezone across DST', () => {
    assert.equal(new Date(Scheduler.eventTimestamp('2026-06-02', '00:15', 'Europe/Paris') - 30 * 60000).toISOString(), '2026-06-01T21:45:00.000Z');
    assert.equal(new Date(Scheduler.eventTimestamp('2026-10-25', '02:30', 'Europe/Paris')).toISOString(), '2026-10-25T00:30:00.000Z');
    assert.equal(new Date(Scheduler.eventTimestamp('2026-03-29', '02:30', 'Europe/Paris')).toISOString(), '2026-03-29T01:30:00.000Z');
});

test('HTTP visibility, individual inscription rejection (single, bulk, update), and event callback', async () => {
    const f = fixture();
    const event = await f.setup();
    await f.scheduler.checkAndNotify();
    const token = f.sends[0].payload.button.action.slice(9);
    const app = express();
    app.use(express.json());
    app.use('/notification-callbacks', createCallbacks({ ...f, eventScheduler: f.scheduler }));
    app.use((req, res, next) => { req.collectiveId = 'demo'; req.user = { role: req.headers['x-role'] || 'member', memberId: req.headers['x-member'] || 'bob', collectiveId: 'demo' }; next(); });
    app.use('/events', createEventsRouter({ ...f, eventScheduler: f.scheduler }));
    app.use('/inscriptions', createInscriptionsRouter(f));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const send = (path, method, body, headers = {}) => fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    try {
        assert.deepEqual(await (await fetch(base + '/events')).json(), []);
        assert.equal((await fetch(base + '/events/' + event.id)).status, 404);
        assert.equal((await fetch(base + '/events/' + event.id, { headers: { 'x-member': 'alice' } })).status, 200);
        assert.equal((await send('/events', 'POST', event)).status, 403);
        for (const headers of [{ 'x-role': 'admin' }, { 'x-member': 'alice' }]) {
            assert.equal((await send('/inscriptions', 'POST', { eventId: event.id, memberId: 'alice', response: 'yes', occurrenceDate: '2099-01-01' }, headers)).status, 400);
            assert.equal((await send('/inscriptions/bulk', 'POST', { eventId: event.id, memberId: 'alice', entries: [{ occurrenceDate: event.date, response: 'yes' }] }, headers)).status, 400);
        }
        const old = await f.dataService.create({ collectiveId: 'demo', collection: 'inscriptions', data: { eventId: event.id, memberId: 'alice' } });
        assert.equal((await send('/inscriptions/' + old.id, 'PUT', { response: 'yes' }, { 'x-role': 'admin' })).status, 400);
        assert.equal((await send('/notification-callbacks/ack', 'POST', { token })).status, 200);
        assert.deepEqual(await f.scheduler.active('demo', { role: 'admin' }), []);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
