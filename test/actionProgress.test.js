const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const FileSystemAdapter = require('../src/backend/storage/FileSystemAdapter');
const DataService = require('../src/backend/services/DataService');
const LogService = require('../src/backend/services/LogService');
const TrashService = require('../src/backend/services/TrashService');
const NotificationStateService = require('../src/backend/services/NotificationStateService');
const ActionProgressService = require('../src/backend/services/ActionProgressService');

const action = { id: 'a', date: '2026-06-01', states: ['Lancée'], memberId: 'm', alert: {
    enabled: true, recipientMode: 'responsible', initialTime: '09:00', stepDelayMinutes: [30]
} };
async function fixture(run) {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'feddeeji-progress-'));
    const storage = new FileSystemAdapter({ basePath });
    const dataService = new DataService({ storage, logService: new LogService({ storage }), trashService: new TrashService({ storage }) });
    const notificationState = new NotificationStateService({ storage });
    const progress = new ActionProgressService({ dataService, notificationState, now: () => 10000 });
    await storage.write({ collectiveId: 'demo', collection: 'actions', id: 'a', data: action });
    await storage.write({ collectiveId: 'demo', collection: 'members', id: 'm', data: { id: 'm' } });
    try { await run({ storage, dataService, notificationState, progress }); }
    finally { await fs.rm(basePath, { recursive: true, force: true }); }
}
const data = { programmeId: 'a', date: '2026-06-01', occurrenceDate: '2026-06-01', state: 1, memberId: 'm', type: 'done' };

test('concurrent validations create one log with a server timestamp', async () => {
    await fixture(async ({ dataService, progress }) => {
        const results = await Promise.all(Array.from({ length: 10 }, () => progress.create({ collectiveId: 'demo', data: { ...data, timestamp: 99999999 } })));
        assert.equal(results.filter(r => !r.duplicate).length, 1);
        const logs = await dataService.list({ collectiveId: 'demo', collection: 'action-logs' });
        assert.equal(logs.length, 1);
        assert.equal(logs[0].timestamp, 10000);
    });
});

test('mobile capability cannot skip a step or validate a later step after first use', async () => {
    await fixture(async ({ progress, notificationState }) => {
        const { revision } = await progress.load('demo', 'a', data.date);
        const token = await notificationState.issueToken('demo', { actionId: 'a', occurrenceDate: data.date, step: 1, memberId: 'm', revision });
        await assert.rejects(progress.create({ collectiveId: 'demo', data: { ...data, state: 2 }, capability: { token } }));
        await progress.create({ collectiveId: 'demo', data, capability: { token } });
        await assert.rejects(progress.create({ collectiveId: 'demo', data: { ...data, state: 2 }, capability: { token } }));
        assert.equal((await progress.load('demo', 'a', data.date)).state, 1);
    });
});

test('metadata edits preserve timing; progression edits and deletion revoke mobile tokens', async () => {
    await fixture(async ({ progress, notificationState }) => {
        const created = await progress.create({ collectiveId: 'demo', data });
        const { revision } = await progress.load('demo', 'a', data.date);
        const token = await notificationState.issueToken('demo', { actionId: 'a', occurrenceDate: data.date, step: 2, memberId: 'm', revision });
        await progress.change({ collectiveId: 'demo', id: created.data.id, data: { notes: 'corrected', timestamp: 9999999 } });
        assert.ok(await notificationState.resolveToken('demo', token));
        assert.equal((await progress.load('demo', 'a', data.date)).latest.timestamp, 10000);
        await progress.change({ collectiveId: 'demo', id: created.data.id, data: { state: 0 } });
        assert.equal(await notificationState.resolveToken('demo', token), null);
        await progress.change({ collectiveId: 'demo', id: created.data.id, remove: true });
        assert.equal((await progress.load('demo', 'a', data.date)).state, 0);
    });
});

test('occurrence validation reuses frontend recurrence rules, including monthly clamping and cancellation', () => {
    const valid = ActionProgressService.isOccurrence.bind(ActionProgressService);
    assert.equal(valid({ date: '2026-01-31', recurrence: 'monthly' }, '2026-02-28'), true);
    assert.equal(valid({ date: '2026-01-31', recurrence: 'monthly' }, '2026-02-27'), false);
    assert.equal(valid({ date: '2026-06-01', recurrence: 'weekly', recurrenceDays: [1, 3] }, '2026-06-03'), true);
    assert.equal(valid({ date: '2026-06-01', recurrence: 'daily', cancelledDates: ['2026-06-02'] }, '2026-06-02'), false);
    assert.equal(valid(action, '2026-02-30'), false);
});
