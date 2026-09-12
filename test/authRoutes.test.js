const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { fixture } = require('./authHelpers');
const createAuthRouter = require('../src/backend/routes/auth');
const createApiRouter = require('../src/backend/routes/api');
const { createAuthMiddleware } = require('../src/backend/middleware/auth');
const DataService = require('../src/backend/services/DataService');
const TrashService = require('../src/backend/services/TrashService');
const LogService = require('../src/backend/services/LogService');
const AuthService = require('../src/backend/services/AuthService');

test('HTTP activation, unified login, permissions, invitations and private state', () => fixture(async ({ auth, storage, sent, putMembers }) => {
    await putMembers([{ id: 'admin', email: 'admin@example.org', admin: true,
        adminPassword: await AuthService.hashPassword('old-password') }]);
    await auth.migrate('demo');
    const trashService = new TrashService({ storage });
    const dataService = new DataService({ storage, trashService, logService: new LogService({ storage }) });
    dataService.authService = auth; trashService.authService = auth;
    const org = { id: 'demo', label: 'Demo', registrationPassword: 'invite-code' };
    const collectiveService = { async getAll() { return [org]; }, async getById(id) { return id === 'demo' ? org : null; } };
    const app = express(); app.use(express.json({ limit: '100kb' }));
    app.use('/auth', createAuthRouter({ authService: auth, collectiveService, dataService }));
    app.use('/api/:collectiveId', createAuthMiddleware(auth), createApiRouter({ dataService, trashService }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (route, body, token, method = body === undefined ? 'GET' : 'POST') => {
        const res = await fetch(base + route, { method, headers: { 'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        return { status: res.status, body: await res.json(), cache: res.headers.get('cache-control') };
    };
    try {
        assert.equal((await request('/auth/collectives')).body[0].registrationPassword, undefined);
        const superadmin = auth.loginSuperadmin({ password: 'super-test' }).token;
        assert.equal((await request('/auth/collectives', undefined, superadmin)).body[0].registrationPassword, 'invite-code');
        for (const route of ['member', 'admin']) assert.equal((await request(`/auth/login/${route}`, { collectiveId: 'demo', email: 'admin@example.org' })).status, 410);
        const login = await request('/auth/login/collective', { collectiveId: 'demo', email: 'admin@example.org', password: 'old-password' });
        assert.equal(login.status, 200);
        assert.equal(login.body.role, 'admin');
        const admin = login.body.token;
        for (const name of ['auth-state', 'AUTH-STATE']) {
            for (const [method, suffix] of [['GET', ''], ['GET', '/admin'], ['POST', ''], ['PUT', '/admin'], ['DELETE', '/admin']]) {
                assert.equal((await request(`/api/demo/${name}${suffix}`, method === 'POST' || method === 'PUT' ? {} : undefined, admin, method)).status, 404);
            }
        }
        const registration = { collectiveId: 'demo', password: 'invite-code', memberData: { email: 'a@example.org', firstName: 'A', lastName: 'Test', admin: true, passwordHash: 'evil' } };
        assert.equal((await request('/auth/register', registration)).status, 201);
        const token = sent.at(-1).token;
        const confirmation = await request('/auth/password/confirm', { collectiveId: 'demo', token, password: 'secure test password' });
        assert.equal(confirmation.status, 200);
        assert.equal(confirmation.cache, 'no-store');
        const memberLogin = await request('/auth/login/collective', { collectiveId: 'demo', email: 'a@example.org', password: 'secure test password' });
        assert.equal(memberLogin.body.role, 'member');
        const member = memberLogin.body.token;
        assert.equal((await request('/api/demo/members', undefined, member)).status, 403);
        assert.equal((await request('/api/other/members/me', undefined, member)).status, 403);
        const me = await request('/api/demo/members/me', { admin: true, passwordHash: 'evil', version: 'evil', firstName: 'Safe' }, member, 'PUT');
        assert.equal(me.body.admin, false);
        assert.equal(me.body.passwordHash, undefined);
        assert.equal(me.body.firstName, 'Safe');
        const invited = await request(`/api/demo/members/${me.body.id}/invite`, {}, admin);
        assert.equal(invited.status, 200);
        const duplicate = await request('/auth/register', registration);
        assert.equal(duplicate.status, 201);
        assert.deepEqual(duplicate.body, { success: true });
        assert.equal((await dataService.list({ collectiveId: 'demo', collection: 'members' })).length, 2);
        const bad = await request('/auth/login/collective', { collectiveId: 'demo', email: 'a@example.org', password: 'bad' });
        const unknown = await request('/auth/login/collective', { collectiveId: 'demo', email: 'missing@example.org', password: 'bad' });
        assert.equal(bad.status, 401); assert.deepEqual(bad.body, unknown.body);
        assert.equal((await request('/auth/password/request', { collectiveId: '../outside', email: 'a@example.org' })).status, 400);
        assert.equal((await request('/auth/email/confirm', { collectiveId: 'demo', token: 'bad' })).status, 400);
    } finally { await new Promise(resolve => server.close(resolve)); }
}));
