const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const FileSystemAdapter = require('../src/backend/storage/FileSystemAdapter');
const LogService = require('../src/backend/services/LogService');
const TrashService = require('../src/backend/services/TrashService');

async function withStorage(run) {
    const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'feddeeji-storage-'));
    try { await run(new FileSystemAdapter({ basePath }), basePath); }
    finally { await fs.rm(basePath, { recursive: true, force: true }); }
}

test('concurrent inserts across adapter instances do not lose records', async () => {
    await withStorage(async (storage, basePath) => {
        const other = new FileSystemAdapter({ basePath });
        await Promise.all(Array.from({ length: 100 }, (_, i) => (i % 2 ? storage : other).write({
            collectiveId: 'demo', collection: 'actions', id: String(i), data: { id: String(i) }
        })));
        assert.equal((await storage.read({ collectiveId: 'demo', collection: 'actions' })).length, 100);
        await Promise.all(Array.from({ length: 50 }, (_, i) => storage.delete({
            collectiveId: 'demo', collection: 'actions', id: String(i)
        })));
        assert.equal((await storage.read({ collectiveId: 'demo', collection: 'actions' })).length, 50);
        assert.deepEqual(await fs.readdir(path.join(basePath, 'demo')), ['actions.json']);
    });
});

test('readers see complete snapshots; failed writes preserve data and release queue', async () => {
    await withStorage(async storage => {
        const params = { collectiveId: 'demo', collection: 'actions' };
        await storage.write({ ...params, id: 'a', data: { id: 'a', value: 1 } });
        const circular = {}; circular.self = circular;
        await assert.rejects(storage.write({ ...params, id: 'bad', data: circular }));
        assert.deepEqual(await storage.read(params), [{ id: 'a', value: 1 }]);
        await Promise.all(Array.from({ length: 30 }, (_, i) => Promise.all([
            storage.write({ ...params, id: 'a', data: { id: 'a', value: i, text: 'x'.repeat(10000) } }),
            storage.read(params).then(items => assert.equal(items.length, 1))
        ])));
    });
});

test('paths cannot escape a collection', async () => {
    await withStorage(async storage => {
        for (const collection of ['../notification-state', 'x/y', '..', '']) {
            await assert.rejects(storage.read({ collectiveId: 'demo', collection }));
        }
        await assert.rejects(storage.write({ collectiveId: '../other', collection: 'actions', data: [] }));
    });
});

test('audit and trash appends are concurrent-safe and logs redact secrets', async () => {
    await withStorage(async storage => {
        const logs = new LogService({ storage });
        const trash = new TrashService({ storage });
        await Promise.all(Array.from({ length: 30 }, (_, i) => Promise.all([
            logs.log({ collectiveId: 'demo', action: 'UPDATE', targetCollection: 'members', targetId: String(i), details: { item: { token: 'secret', haWebhookId: 'secret2', name: 'ok' } } }),
            trash.moveToTrash({ collectiveId: 'demo', sourceCollection: 'actions', item: { id: String(i) } })
        ])));
        const records = await logs.getLogs({ collectiveId: 'demo' });
        assert.equal(records.length, 30);
        assert.equal(JSON.stringify(records).includes('secret'), false);
        assert.equal(records[0].details.item.name, 'ok');
        assert.equal((await trash.list({ collectiveId: 'demo' })).length, 30);
    });
});
