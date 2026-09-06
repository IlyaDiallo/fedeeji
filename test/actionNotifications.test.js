const test = require('node:test');
const assert = require('node:assert/strict');
const Scheduler = require('../src/backend/services/ActionNotificationScheduler');
const State = require('../src/backend/services/NotificationStateService');
const Progress = require('../src/backend/services/ActionProgressService');

async function fixture() {
    const collections = new Map();
    const storage = {
        async read({ collectiveId, collection, id }) {
            const items = collections.get(`${collectiveId}/${collection}`) || [];
            return structuredClone(id ? items.find(i => i.id === id) : items);
        },
        async write({ collectiveId, collection, id, data }) {
            const key = `${collectiveId}/${collection}`;
            const items = collections.get(key) || [];
            collections.set(key, [...items.filter(i => i.id !== id), structuredClone(data)]);
        },
        async delete({ collectiveId, collection, id }) {
            const key = `${collectiveId}/${collection}`;
            collections.set(key, (collections.get(key) || []).filter(i => i.id !== id));
        }
    };
    const dataService = { list: p => storage.read(p), get: p => storage.read(p) };
    const action = { id: 'a', name: 'Lessive', date: '2026-06-01', states: ['Lancée', 'Séchée'], alert: {
        enabled: true, initialTime: '09:00', recipientMode: 'selected', memberIds: ['m', 'n'], stepDelayMinutes: [30, 120]
    } };
    await storage.write({ collectiveId: 'demo', collection: 'actions', id: 'a', data: action });
    for (const id of ['m', 'n']) await storage.write({ collectiveId: 'demo', collection: 'members', id, data: { id, haWebhookUrl: `https://ha.example.org/api/webhook/${id}` } });
    let now = Date.parse('2026-06-01T06:59:00Z');
    const nowFn = () => now;
    const state = new State({ storage, now: nowFn });
    await state.setSettings('demo', { timeZone: 'Europe/Paris', quietStart: '22:00', quietEnd: '08:00', allowedOrigins: ['https://ha.example.org'] });
    const progress = new Progress({ dataService, notificationState: state, now: nowFn });
    const sent = [];
    let failN = false;
    const params = { collectiveService: { async getAll() { return [{ id: 'demo', label: 'Maison' }]; } },
        dataService, notificationState: state, progressService: progress, now: nowFn,
        async send(message) {
            sent.push(message);
            if (failN && message.webhookUrl.endsWith('/n')) throw new Error('offline');
        }
    };
    const scheduler = new Scheduler(params);
    return { scheduler, state, storage, sent, params, setNow: value => { now = Date.parse(value); }, fail: value => { failN = value; } };
}

test('initial hour, ten-minute repetitions and persistence across restart', async () => {
    const f = await fixture();
    await f.scheduler.checkAndNotify(); assert.equal(f.sent.length, 0);
    f.setNow('2026-06-01T07:00:00Z'); await f.scheduler.checkAndNotify(); assert.equal(f.sent.length, 2);
    f.setNow('2026-06-01T07:09:59Z'); await new Scheduler(f.params).checkAndNotify(); assert.equal(f.sent.length, 2);
    f.setNow('2026-06-01T07:10:00Z'); await new Scheduler(f.params).checkAndNotify(); assert.equal(f.sent.length, 4);
    assert.equal(f.sent[0].payload.notificationId, f.sent[2].payload.notificationId);
});

test('failure retries only the failed recipient; quiet hours suppress reminders without a catch-up burst', async () => {
    const f = await fixture(); f.setNow('2026-06-01T07:00:00Z'); f.fail(true);
    await f.scheduler.checkAndNotify(); assert.equal(f.sent.length, 2);
    f.setNow('2026-06-01T07:00:30Z'); f.fail(false);
    await f.scheduler.checkAndNotify(); assert.equal(f.sent.length, 3);
    assert.ok(f.sent[2].webhookUrl.endsWith('/n'));
    f.setNow('2026-06-01T21:00:00Z'); await f.scheduler.checkAndNotify(); assert.equal(f.sent.length, 3);
    f.setNow('2026-06-02T06:00:00Z'); await f.scheduler.checkAndNotify(); assert.equal(f.sent.length, 5);
});

test('progression clears everyone and next step is relative to previous validation', async () => {
    const f = await fixture(); f.setNow('2026-06-01T07:00:00Z'); await f.scheduler.checkAndNotify();
    await f.storage.write({ collectiveId: 'demo', collection: 'action-logs', id: 'log1', data: {
        id: 'log1', programmeId: 'a', date: '2026-06-01', state: 1, timestamp: Date.parse('2026-06-01T07:05:00Z')
    } });
    f.setNow('2026-06-01T07:05:00Z'); await f.scheduler.checkAndNotify();
    assert.equal(f.sent.filter(s => s.payload.type === 'clear').length, 2);
    f.setNow('2026-06-01T07:34:00Z'); await f.scheduler.checkAndNotify(); assert.equal(f.sent.length, 4);
    f.setNow('2026-06-01T07:35:00Z'); await f.scheduler.checkAndNotify(); assert.equal(f.sent.at(-1).payload.step, 2);
    await f.storage.write({ collectiveId: 'demo', collection: 'action-logs', id: 'log2', data: {
        id: 'log2', programmeId: 'a', date: '2026-06-01', state: 2, timestamp: Date.parse('2026-06-01T08:00:00Z')
    } });
    f.setNow('2026-06-01T09:59:00Z'); await f.scheduler.checkAndNotify();
    assert.equal(f.sent.filter(s => s.payload.step === 3).length, 0);
    f.setNow('2026-06-01T10:00:00Z'); await f.scheduler.checkAndNotify();
    assert.equal(f.sent.filter(s => s.payload.step === 3).length, 2);
});

test('removing a recipient clears only their notification and leaves other buttons valid', async () => {
    const f = await fixture(); f.setNow('2026-06-01T07:00:00Z'); await f.scheduler.checkAndNotify();
    const action = await f.storage.read({ collectiveId: 'demo', collection: 'actions', id: 'a' });
    action.alert.memberIds = ['m'];
    await f.storage.write({ collectiveId: 'demo', collection: 'actions', id: 'a', data: action });
    await f.scheduler.checkAndNotify();
    const reminder = f.sent.filter(s => s.payload.type === 'reminder').at(-1);
    const token = reminder.payload.button.action.slice(9);
    assert.ok(await f.state.resolveToken('demo', token));
    const clears = f.sent.filter(s => s.payload.type === 'clear');
    assert.equal(clears.length, 1);
    assert.ok(clears[0].webhookUrl.endsWith('/n'));
});

test('disabled or historical actions never broadcast to configured members', async () => {
    const f = await fixture(); f.setNow('2026-06-01T07:00:00Z');
    const action = await f.storage.read({ collectiveId: 'demo', collection: 'actions', id: 'a' });
    delete action.alert;
    await f.storage.write({ collectiveId: 'demo', collection: 'actions', id: 'a', data: action });
    await f.scheduler.checkAndNotify();
    assert.equal(f.sent.length, 0);
});

test('timezone and quiet-hour boundaries are explicit across DST', () => {
    assert.deepEqual(Scheduler.localClock(Date.parse('2026-03-29T01:00:00Z'), 'Europe/Paris'), { date: '2026-03-29', time: '03:00' });
    assert.equal(Scheduler.isQuiet('22:00', { quietStart: '22:00', quietEnd: '08:00' }), true);
    assert.equal(Scheduler.isQuiet('08:00', { quietStart: '22:00', quietEnd: '08:00' }), false);
});
