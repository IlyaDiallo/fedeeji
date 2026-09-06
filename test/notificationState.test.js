const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const FileSystemAdapter = require('../src/backend/storage/FileSystemAdapter');
const NotificationStateService = require('../src/backend/services/NotificationStateService');
const DataService = require('../src/backend/services/DataService');
const TrashService = require('../src/backend/services/TrashService');

async function fixture(run) {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'feddeeji-notifications-'));
    let now = 1000;
    const storage = new FileSystemAdapter({ basePath });
    const state = new NotificationStateService({ storage, now: () => now });
    try { await run({ storage, state, basePath, advance: ms => { now += ms; } }); }
    finally { await fs.rm(basePath, { recursive: true, force: true }); }
}
const scope = { actionId: 'a', occurrenceDate: '2026-06-01', step: 1, memberId: 'm', revision: 'r' };

test('capabilities persist only as hashes and stay scoped across restart', async () => {
    await fixture(async ({ storage, state, basePath, advance }) => {
        const token = await state.issueToken('demo', scope, 5000);
        assert.equal(token.length, 43);
        const disk = await fs.readFile(path.join(basePath, 'demo/notification-state.json'), 'utf8');
        assert.equal(disk.includes(token), false);
        const restarted = new NotificationStateService({ storage, now: () => 1000 });
        assert.equal((await restarted.resolveToken('demo', token)).memberId, 'm');
        assert.equal(await restarted.resolveToken('other', token), null);
        assert.equal(await restarted.resolveToken('demo', '../bad'), null);
        advance(5000);
        assert.equal(await state.resolveToken('demo', token), null);
        await state.pruneTokens('demo');
        assert.deepEqual(await storage.read({ collectiveId: 'demo', collection: 'notification-state' }), []);
    });
});

test('revocation affects every recipient of a step, not the following step', async () => {
    await fixture(async ({ state }) => {
        const tokens = await Promise.all(['m', 'n'].map(memberId => state.issueToken('demo', { ...scope, memberId })));
        const next = await state.issueToken('demo', { ...scope, step: 2 });
        await state.revokeTokens('demo', { actionId: 'a', occurrenceDate: scope.occurrenceDate, step: 1 });
        for (const token of tokens) assert.equal(await state.resolveToken('demo', token), null);
        assert.equal((await state.resolveToken('demo', next)).step, 2);
    });
});

test('settings and per-recipient delivery attempts survive restart; diagnostics project safe fields', async () => {
    await fixture(async ({ storage, state }) => {
        const settings = { timeZone: 'Europe/Paris', quietStart: '22:00', quietEnd: '08:00', allowedOrigins: ['https://ha.example.org'] };
        await state.setSettings('demo', settings);
        await Promise.all(['m', 'n'].map(memberId => state.saveDelivery('demo', {
            ...scope, memberId, lastSuccessAt: 1000, nextAttemptAt: 601000, tokenHash: 'hidden', active: true
        })));
        const restarted = new NotificationStateService({ storage });
        assert.equal((await restarted.getSettings('demo')).timeZone, settings.timeZone);
        assert.equal((await restarted.listDeliveries('demo')).length, 2);
        assert.equal(JSON.stringify(await restarted.diagnostics('demo')).includes('hidden'), false);
        assert.deepEqual(await restarted.listDeliveries('other'), []);
    });
});

test('generic data and crafted trash entries cannot reach internal state', async () => {
    await fixture(async ({ storage }) => {
        const data = new DataService({ storage });
        const params = { collectiveId: 'demo', collection: 'notification-state', id: 'settings', data: {} };
        for (const method of ['list', 'get', 'create', 'update', 'delete']) {
            await assert.rejects(data[method](params), /interne/);
        }
        const trash = new TrashService({ storage });
        await assert.rejects(trash.moveToTrash({ collectiveId: 'demo', sourceCollection: 'notification-state', item: {} }), /interne/);
        await storage.write({ collectiveId: 'demo', collection: 'trash', id: 'hostile', data: {
            id: 'hostile', sourceCollection: 'notification-state', item: { id: 'settings' }
        } });
        await assert.rejects(trash.restore({ collectiveId: 'demo', trashId: 'hostile' }), /interne/);
    });
});
