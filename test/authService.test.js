const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { fixture } = require('./authHelpers');
const AuthService = require('../src/backend/services/AuthService');

test('one login derives role and rejects old/revoked sessions; global superadmin unchanged', () => fixture(async ({ auth, storage, putMembers, sent }) => {
    await putMembers([{ id: 'a', email: 'admin@example.org', admin: true,
        adminPassword: await AuthService.hashPassword('old-password') }]);
    await auth.migrate('demo');
    const login = () => auth.loginCollective({ collectiveId: 'demo', email: 'ADMIN@example.org', password: 'old-password' });
    const result = await login();
    assert.equal(result.role, 'admin');
    assert.equal((await auth.verifyToken(result.token)).memberId, 'a');
    await assert.rejects(auth.loginCollective({ collectiveId: 'demo', email: 'admin@example.org' }), /incorrect/);
    const old = jwt.sign({ role: 'member', collectiveId: 'demo', memberId: 'a' }, auth.jwtSecret);
    await assert.rejects(auth.verifyToken(old), /invalide/);
    await auth.requestPassword({ collectiveId: 'demo', email: 'admin@example.org' });
    await auth.confirmPassword({ collectiveId: 'demo', token: sent.at(-1).token, password: 'a new secure password' });
    await assert.rejects(auth.verifyToken(result.token), /expirée/);
    await assert.rejects(login(), /incorrect/);
    const superadmin = auth.loginSuperadmin({ password: 'super-test' });
    assert.equal((await auth.verifyToken(superadmin.token)).role, 'superadmin');
    const next = await auth.loginCollective({ collectiveId: 'demo', email: 'admin@example.org', password: 'a new secure password' });
    await storage.mutate({ collectiveId: 'demo', collection: 'members' }, rows => { rows[0].admin = false; });
    await assert.rejects(auth.verifyToken(next.token), /expirée/);
}));
