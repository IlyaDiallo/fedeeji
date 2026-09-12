const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const FileSystemAdapter = require('../src/backend/storage/FileSystemAdapter');
const AuthStateService = require('../src/backend/services/AuthStateService');
const DataService = require('../src/backend/services/DataService');
const TrashService = require('../src/backend/services/TrashService');

test('auth state mutations are atomic, rollback on failure and remain private', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'auth-state-'));
    try {
        const storage = new FileSystemAdapter({ basePath: dir });
        const state = new AuthStateService({ storage });
        await state.mutate('demo', rows => { rows.push({ id: 'one', uses: 0 }); });
        const results = await Promise.all(Array.from({ length: 20 }, () => state.mutate('demo', rows => {
            if (rows[0].uses) return false;
            rows[0].uses++;
            return true;
        })));
        assert.equal(results.filter(Boolean).length, 1);
        await assert.rejects(state.mutate('demo', rows => { rows[0].uses = 9; throw Error('abort'); }));
        assert.equal((await state.read('demo', 'one')).uses, 1);
        const data = new DataService({ storage });
        const trash = new TrashService({ storage });
        for (const collection of ['auth-state', 'AUTH-STATE']) {
            for (const method of ['list', 'get', 'create', 'update', 'delete']) {
                await assert.rejects(data[method]({ collectiveId: 'demo', collection, id: 'one', data: {} }), /interne/);
            }
            await assert.rejects(trash.moveToTrash({ collectiveId: 'demo', sourceCollection: collection, item: {} }), /interne/);
        }
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
