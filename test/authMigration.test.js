const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { fixture } = require('./authHelpers');

test('migration keeps admin hash, blocks ambiguous accounts and is replayable', () => fixture(async ({ auth, storage, putMembers }) => {
    const hash = await bcrypt.hash('old-password', 10);
    await putMembers([{ id: 'admin', email: ' ADMIN@Example.org ', admin: true, adminPassword: hash },
        { id: 'a', email: 'dup@example.org' }, { id: 'b', email: 'DUP@example.org' }, { id: 'invalid', email: '' }]);
    await storage.write({ collectiveId: 'demo', collection: 'trash', data: [{ id: 't', item: { adminPassword: hash } }] });
    const report = await auth.migrate('demo');
    assert.equal(report.length, 3);
    const first = await auth.state.read('demo', 'admin');
    assert.equal(first.email, 'admin@example.org');
    assert.equal(await bcrypt.compare('old-password', first.passwordHash), true);
    await auth.migrate('demo');
    assert.deepEqual(await auth.state.read('demo', 'admin'), first);
    assert.equal(JSON.stringify(await storage.read({ collectiveId: 'demo', collection: 'members' })).includes(hash), false);
    assert.equal(JSON.stringify(await storage.read({ collectiveId: 'demo', collection: 'trash' })).includes(hash), false);
}));

test('migration repairs an interrupted email projection', () => fixture(async ({ auth, storage, putMembers }) => {
    await putMembers([{ id: 'a', email: 'old@example.org' }]);
    await auth.migrate('demo');
    await auth.state.mutate('demo', rows => { rows[0].email = 'new@example.org'; });
    await auth.migrate('demo');
    assert.equal((await storage.read({ collectiveId: 'demo', collection: 'members', id: 'a' })).email, 'new@example.org');
}));

test('interrupted member creation reserves identity and is recovered without losing HA settings', () => fixture(async ({ auth, storage }) => {
    const write = storage.write.bind(storage);
    let fail = true;
    storage.write = async params => {
        if (fail && params.collection === 'members') { fail = false; throw Error('simulated disk failure'); }
        return write(params);
    };
    await assert.rejects(auth.createMember({ collectiveId: 'demo', data: {
        email: 'a@example.org', firstName: 'A', haBaseUrl: 'https://ha.example.org', haWebhookId: 'legacy-webhook'
    } }), /disk failure/);
    await assert.rejects(auth.createMember({ collectiveId: 'demo', data: { email: 'a@example.org' } }), /indisponible/);
    await auth.migrate('demo');
    const [member] = await storage.read({ collectiveId: 'demo', collection: 'members' });
    assert.equal(member.email, 'a@example.org');
    assert.equal(member.haWebhookId, 'legacy-webhook');
    assert.equal((await auth.state.read('demo', member.id)).pendingMember, undefined);
}));
