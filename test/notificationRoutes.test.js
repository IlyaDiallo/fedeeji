const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
// AuthService validates configuration at import; these are test-only values.
process.env.SUPERADMIN_PASSWORD = 'test-only-password';
process.env.JWT_SECRET = 'test-only-secret-not-for-production';
const createApiRouter = require('../src/backend/routes/api');
const createNotificationsRouter = require('../src/backend/routes/notifications');

test('settings, diagnostics and manual checks are admin-only and collective-scoped', async () => {
    const calls = [];
    const app = express();
    app.use(express.json());
    app.use('/api/:collectiveId/notifications', (req, res, next) => {
        req.collectiveId = req.params.collectiveId;
        req.user = { role: req.headers['x-test-role'] || 'admin', collectiveId: 'demo' };
        next();
    }, createNotificationsRouter({
        dataService: { async list() { return []; } },
        notificationState: {
            async getSettings(id) { calls.push(id); return null; },
            async setSettings(id, body) { calls.push(id); return body; },
            async diagnostics(id) { calls.push(id); return []; }
        },
        scheduler: { async checkAndNotify(id) { calls.push(id); } }
    }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    try {
        for (const [method, route] of [['GET', 'settings'], ['PUT', 'settings'], ['GET', 'diagnostics'], ['POST', 'trigger']]) {
            assert.equal((await fetch(`${base}/other/notifications/${route}`, { method })).status, 403);
            assert.equal((await fetch(`${base}/demo/notifications/${route}`, { method, headers: { 'x-test-role': 'member' } })).status, 403);
            assert.equal((await fetch(`${base}/demo/notifications/${route}`, { method })).status, 200);
        }
        assert.ok(calls.length > 0);
        assert.ok(calls.every(id => id === 'demo'));
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('all generic HTTP methods reject internal notification collections before storage access', async () => {
    const dataService = new Proxy({}, { get() { return () => { throw new Error('Storage must not be accessed'); }; } });
    const app = express();
    app.use(express.json());
    app.use('/api/:collectiveId', (req, res, next) => {
        req.user = { role: 'admin', collectiveId: req.params.collectiveId };
        next();
    }, createApiRouter({ dataService }));
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
        for (const [method, suffix] of [['GET', ''], ['GET', '/settings'], ['POST', ''], ['PUT', '/settings'], ['DELETE', '/settings']]) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/demo/notification-state${suffix}`, {
                method, ...(method === 'POST' || method === 'PUT' ? {
                    headers: { 'content-type': 'application/json' }, body: '{}'
                } : {})
            });
            assert.equal(response.status, 404, `${method} ${suffix}`);
        }
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
