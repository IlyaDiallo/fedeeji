const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const createRouter = require('../src/backend/routes/notificationCallbacks');

test('callback is POST-only, validates scoped token, and limits requests', async () => {
    const token = 'a'.repeat(43);
    let accepted;
    const app = express();
    app.use(express.json());
    app.use('/notification-callbacks', createRouter({
        collectiveService: { async getAll() { return [{ id: 'demo' }]; } },
        notificationState: {
            async resolveToken(id, value) { return value === token ? { actionId: 'a', occurrenceDate: '2026-06-01', step: 2, memberId: 'm' } : null; },
            async getSettings() { return { timeZone: 'Europe/Paris' }; }
        },
        progressService: { async create(params) { accepted = params; } },
        now: () => Date.parse('2026-06-01T23:00:00Z')
    }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const url = `http://127.0.0.1:${server.address().port}/notification-callbacks/ack`;
    const post = value => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: value }) });
    try {
        assert.equal((await fetch(url)).status, 404);
        assert.equal((await post('../bad')).status, 400);
        assert.equal((await post('b'.repeat(43))).status, 409);
        assert.equal((await post(token)).status, 200);
        assert.equal(accepted.collectiveId, 'demo');
        assert.equal(accepted.data.date, '2026-06-02');
        assert.equal(accepted.data.state, 2);
        assert.equal(accepted.data.memberId, 'm');
        for (let i = 0; i < 118; i++) await post('bad');
        assert.equal((await post(token)).status, 429);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
