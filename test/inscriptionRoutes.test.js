const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const router = require('../src/backend/routes/inscriptions');
const EventService = require('../src/backend/services/EventService');
const Utils = require('../src/frontend/js/InscriptionUtils');

test('HTTP series scope, ownership, validation, explicit overrides and legacy upsert', async () => {
    const records = new Map();
    let id = 0;
    const key = p => `${p.collectiveId}/${p.collection}`;
    const dataService = {
        async list(p) { return structuredClone(records.get(key(p)) || []); },
        async get(p) { return (await this.list(p)).find(i => i.id === p.id) || null; },
        async create(p) { const item = { ...p.data, id: String(++id) }; records.set(key(p), [...await this.list(p), item]); return item; },
        async update(p) { const items = await this.list(p); const i = items.find(i => i.id === p.id); if (!i) throw Error('missing'); Object.assign(i, p.data); records.set(key(p), items); return i; },
        async delete(p) { records.set(key(p), (await this.list(p)).filter(i => i.id !== p.id)); }
    };
    const make = (collection, data, collectiveId = 'c') => dataService.create({ collectiveId, collection, data });
    const m = await make('members', {});
    const other = await make('members', {});
    const event = await make('events', { date: '2026-01-01', recurrence: 'daily' });
    const individual = await make('events', { date: '2040-01-01', type: 'individual', recurrence: 'daily' });
    const unique = await make('events', { date: '2040-01-01', recurrence: 'none' });
    const ended = await make('events', { date: '2020-01-01', recurrence: 'daily', recurrenceEndDate: '2020-02-01' });
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.collectiveId = req.headers['x-collective'] || 'c'; req.user = { role: req.headers['x-role'] || 'member', memberId: m.id, collectiveId: 'c' }; next(); });
    app.use('/inscriptions', router({ dataService, eventService: new EventService({ dataService }) }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/inscriptions`;
    const send = (path, method, body, headers = {}) => fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    try {
        const input = { eventId: event.id, memberId: other.id, active: true };
        const registered = await (await send('/series', 'PUT', input)).json();
        assert.equal(registered.memberId, m.id); // Cannot impersonate another member.
        assert.equal(registered.periods[0].startsOn, Utils.today());
        assert.equal((await send('/series', 'PUT', input)).status, 200);
        assert.equal((await dataService.list({ collectiveId: 'c', collection: 'inscriptions' })).length, 1);
        const adminSeries = await (await send('/series', 'PUT', input, { 'x-role': 'admin' })).json();
        assert.equal(adminSeries.memberId, other.id);
        assert.equal((await send('/' + adminSeries.id, 'GET')).status, 403);
        assert.equal((await send('/' + adminSeries.id, 'PUT', { response: 'no' })).status, 403);
        assert.equal((await send('/' + registered.id, 'PUT', { periods: [] })).status, 400);
        assert.equal((await send('/' + registered.id, 'DELETE', undefined, { 'x-role': 'admin' })).status, 400);
        for (const eventId of [individual.id, unique.id, ended.id, 'missing']) {
            assert.equal((await send('/series', 'PUT', { ...input, eventId })).status, 400);
        }
        assert.equal((await send('/series', 'PUT', input, { 'x-collective': 'elsewhere' })).status, 403);
        assert.equal((await send('/series', 'PUT', { ...input, memberId: 'absent' }, { 'x-role': 'admin' })).status, 400);
        assert.equal((await send('', 'POST', { eventId: event.id, memberId: m.id, scope: 'series', periods: [] })).status, 400);
        const bulk = entries => send('/bulk', 'POST', { eventId: event.id, entries });
        assert.equal((await bulk([{ occurrenceDate: '2020-01-01', response: 'yes' }])).status, 400); // Not an occurrence.
        assert.equal((await bulk([{ occurrenceDate: '2026-01-01', response: 'yes' }])).status, 403);
        assert.equal((await bulk([{ occurrenceDate: '2040-01-01', response: 'bad' }])).status, 400);
        assert.equal((await bulk([{ occurrenceDate: '2040-01-01', response: 'no' }])).status, 200);
        let inscriptions = await dataService.list({ collectiveId: 'c', collection: 'inscriptions' });
        assert.equal(Utils.resolve({ event, inscriptions, memberId: m.id, date: '2040-01-01' }), 'no');
        await send('/series', 'PUT', { ...input, active: false });
        inscriptions = await dataService.list({ collectiveId: 'c', collection: 'inscriptions' });
        assert.equal(Utils.resolve({ event, inscriptions, memberId: m.id, date: '2040-01-01' }), 'no');
        await send('/series', 'PUT', input);
        await bulk([{ occurrenceDate: '2040-01-01', response: null }]);
        inscriptions = await dataService.list({ collectiveId: 'c', collection: 'inscriptions' });
        assert.equal(Utils.resolve({ event, inscriptions, memberId: m.id, date: '2040-01-01' }), 'yes');
        const legacy = await make('inscriptions', { eventId: unique.id, memberId: m.id, response: 'yes' });
        const upsert = await (await send('', 'POST', { eventId: unique.id, memberId: m.id, response: 'no' })).json();
        assert.equal(upsert.id, legacy.id);
        assert.equal(upsert.response, 'no');
    } finally { await new Promise(resolve => server.close(resolve)); }
});
