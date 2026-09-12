const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./authHelpers');
const DataService = require('../src/backend/services/DataService');
const TrashService = require('../src/backend/services/TrashService');
const LogService = require('../src/backend/services/LogService');

function services(auth, storage) {
    const trash = new TrashService({ storage });
    const data = new DataService({ storage, trashService: trash, logService: new LogService({ storage }) });
    data.authService = auth; trash.authService = auth;
    return { data, trash };
}
const actor = { role: 'superadmin' };

test('email stays active until confirmed; self change needs password; sessions revoked', () => fixture(async ({ auth, storage, sent }) => {
    const { data } = services(auth, storage);
    const member = await data.create({ collectiveId: 'demo', collection: 'members', data: { email: 'old@example.org', adminPassword: 'injected' } });
    assert.equal(member.adminPassword, undefined);
    await auth.requestPassword({ collectiveId: 'demo', email: member.email });
    await auth.confirmPassword({ collectiveId: 'demo', token: sent.at(-1).token, password: 'secure test password' });
    const login = await auth.loginCollective({ collectiveId: 'demo', email: member.email, password: 'secure test password' });
    const self = await auth.verifyToken(login.token);
    const params = { collectiveId: 'demo', collection: 'members', id: member.id, actor: self };
    await assert.rejects(data.update({ ...params, data: { email: 'new@example.org' } }), /actuel/);
    const edited = await data.update({ ...params, data: { email: 'new@example.org', currentPassword: 'secure test password', admin: true, passwordHash: 'evil' } });
    assert.equal(edited.email, member.email);
    assert.equal(edited.pendingEmail, 'new@example.org');
    assert.equal(edited.admin, false);
    const token = sent.at(-1).token;
    const results = await Promise.allSettled([1, 2].map(() => auth.confirmEmail({ collectiveId: 'demo', token })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    await assert.rejects(auth.verifyToken(login.token));
    assert.equal((await data.get({ ...params })).email, 'new@example.org');
    assert.equal(JSON.stringify(await data.list({ collectiveId: 'demo', collection: 'logs' })).includes('secure test password'), false);
}));

test('concurrent identities remain unique; restore requires activation and rejects duplicates', () => fixture(async ({ auth, storage, sent }) => {
    const { data, trash } = services(auth, storage);
    const create = email => data.create({ collectiveId: 'demo', collection: 'members', data: { email } });
    const results = await Promise.allSettled([create('a@example.org'), create('A@example.org')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const a = results.find(r => r.status === 'fulfilled').value;
    const b = await create('b@example.org');
    const update = (id, email) => data.update({ collectiveId: 'demo', collection: 'members', id, data: { email }, actor });
    await update(a.id, 'new@example.org'); const ta = sent.at(-1).token;
    await update(b.id, 'new@example.org'); const tb = sent.at(-1).token;
    const confirmed = await Promise.allSettled([ta, tb].map(token => auth.confirmEmail({ collectiveId: 'demo', token })));
    assert.equal(confirmed.filter(r => r.status === 'fulfilled').length, 1);
    await data.delete({ collectiveId: 'demo', collection: 'members', id: a.id });
    assert.equal((await auth.state.read('demo', a.id)).disabled, true);
    const [entry] = await trash.list({ collectiveId: 'demo' });
    await trash.restore({ collectiveId: 'demo', trashId: entry.id });
    assert.equal((await auth.state.read('demo', a.id)).passwordHash, null);
    await data.delete({ collectiveId: 'demo', collection: 'members', id: a.id });
    await create('new@example.org');
    const [again] = await trash.list({ collectiveId: 'demo' });
    await assert.rejects(trash.restore({ collectiveId: 'demo', trashId: again.id }), /indisponible/);
}));
