const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const createActionsRouter = require('../src/backend/routes/actions');
const { normalizeAlert, recipientIds } = require('../src/backend/services/NotificationConfig');
const ActionProgressService = require('../src/backend/services/ActionProgressService');

const alert = { enabled: true, recipientMode: 'responsible', initialTime: '09:00', stepDelayMinutes: [] };

test('responsible alerts include every owner, with legacy fallback', () => {
    const action = { memberIds: ['alice', 'bob', 'alice'], alert };
    assert.deepEqual(recipientIds(action), ['alice', 'bob']);
    assert.deepEqual(recipientIds({ memberId: 'alice', alert }), ['alice']);
    assert.deepEqual(recipientIds({ memberId: 'alice', memberIds: [], alert }), []);
    assert.equal(normalizeAlert(alert, { ...action, members: [{ id: 'alice' }, { id: 'bob' }] }).enabled, true);
    assert.throws(() => normalizeAlert(alert, { memberIds: [], members: [] }));
    const revision = a => ActionProgressService.context(a, [], '2026-01-01').revision;
    assert.notEqual(revision(action), revision({ ...action, memberIds: ['alice'] }));
    assert.equal(revision(action), revision({ ...action, memberIds: ['bob', 'alice'] }));
});

test('action API persists multiple owners, validates them and allows clearing them', async () => {
    let stored;
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = { role: 'admin', collectiveId: 'demo' }; req.collectiveId = 'demo'; next(); });
    app.use('/actions', createActionsRouter({
        illustrationService: { normalizeRecipe: () => ({}) },
        dataService: {
            list: async () => [{ id: 'alice' }, { id: 'bob' }],
            create: async ({ data }) => (stored = { ...data, id: 'one' }),
            get: async () => stored,
            update: async ({ data }) => (stored = { ...stored, ...data })
        }
    }));
    const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
    const send = (method, data) => fetch(`http://127.0.0.1:${server.address().port}/actions${method === 'PUT' ? '/one' : ''}`, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
    });
    try {
        assert.equal((await send('POST', { memberIds: ['alice', 'bob', 'alice'] })).status, 201);
        assert.deepEqual(stored.memberIds, ['alice', 'bob']);
        assert.equal((await send('PUT', { memberIds: ['outsider'] })).status, 400);
        assert.equal((await send('PUT', { memberIds: 'alice' })).status, 400);
        await send('PUT', { name: 'Updated' });
        assert.deepEqual(stored.memberIds, ['alice', 'bob']);
        await send('PUT', { memberIds: [] });
        assert.deepEqual(stored.memberIds, []);
        await send('PUT', { memberId: 'bob' });
        assert.deepEqual(stored.memberIds, ['bob']);
        assert.equal(stored.memberId, null);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
