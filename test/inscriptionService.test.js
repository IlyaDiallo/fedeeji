const test = require('node:test');
const assert = require('node:assert/strict');
const Service = require('../src/backend/services/InscriptionService');
const EventService = require('../src/backend/services/EventService');
function fixture() {
    const records = { events: [{ id: 'e', date: '2026-01-01', recurrence: 'daily' }], members: [{ id: 'm' }], inscriptions: [] };
    const dataService = {
        async list({ collection }) { return structuredClone(records[collection]); },
        async get({ collection, id }) { return structuredClone(records[collection].find(i => i.id === id)); },
        async create({ collection, data }) { const item = { ...data, id: String(records[collection].length) }; records[collection].push(item); return item; },
        async update({ collection, id, data }) { const item = records[collection].find(i => i.id === id); Object.assign(item, data); return item; }
    };
    let today = '2026-02-01';
    const eventService = new EventService({ dataService });
    return { records, eventService, service: new Service({ dataService, eventService, today: () => today }), setDate: d => { today = d; } };
}
test('series mutations are idempotent under concurrency and preserve closed periods', async () => {
    const f = fixture();
    const input = { eventId: 'e', memberId: 'm', active: true };
    await Promise.all(Array.from({ length: 10 }, () => f.service.setSeries('c', input)));
    assert.equal(f.records.inscriptions.length, 1);
    assert.equal(f.records.inscriptions[0].periods.length, 1);
    f.setDate('2026-03-01');
    await f.service.setSeries('c', { ...input, active: false });
    f.setDate('2026-04-01');
    await f.service.setSeries('c', input);
    assert.deepEqual(f.records.inscriptions[0].periods, [{ startsOn: '2026-02-01', endsBefore: '2026-03-01' }, { startsOn: '2026-04-01', endsBefore: null }]);
    await assert.rejects(f.eventService.save('c', 'e', { recurrence: 'none' }), /Clôturez/);
});
test('validate series identity and occurrence responses', async () => {
    const f = fixture();
    for (const input of [{ eventId: 'absent', memberId: 'm', active: true }, { eventId: 'e', memberId: 'other', active: true }, { eventId: 'e', memberId: 'm', active: 'yes' }]) {
        await assert.rejects(f.service.setSeries('c', input));
    }
    const e = f.records.events[0];
    assert.throws(() => f.service.validateEntry(e, { occurrenceDate: '2026-01-01', response: 'yes' }, { role: 'member' }), /past_event_locked/);
    assert.throws(() => f.service.validateEntry(e, { occurrenceDate: '2026-02-30', response: 'yes' }, { role: 'admin' }));
    assert.throws(() => f.service.validateEntry(e, { occurrenceDate: '2026-02-01', response: 'bad' }, { role: 'admin' }));
});
