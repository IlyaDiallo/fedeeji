const test = require('node:test');
const assert = require('node:assert/strict');
const Utils = require('../src/frontend/js/InscriptionUtils');
const event = { id: 'e', date: '2026-01-01', recurrence: 'weekly' };
const series = { scope: 'series', eventId: 'e', memberId: 'm', periods: [{ startsOn: '2026-02-01', endsBefore: '2026-03-01' }, { startsOn: '2026-04-01', endsBefore: null }] };
const resolve = (date, extra = [], evt = event) => Utils.resolve({ event: evt, inscriptions: [series, ...extra], memberId: 'm', date });
test('series periods include future dates without materializing them and preserve gaps', () => {
    assert.equal(resolve('2026-01-01'), null);
    assert.equal(resolve('2026-02-01'), 'yes');
    assert.equal(resolve('2026-03-01'), null);
    assert.equal(resolve('2040-01-01'), 'yes');
});
test('explicit responses override series and removal restores inheritance', () => {
    for (const response of ['yes', 'no', 'maybe']) {
        assert.equal(resolve('2026-05-01', [{ eventId: 'e', memberId: 'm', occurrenceDate: '2026-05-01', response }]), response);
    }
    assert.equal(resolve('2026-05-01'), 'yes');
});
test('legacy undated records only target initial date; cancelled and nonrecurring dates do not inherit', () => {
    const legacy = { eventId: 'e', memberId: 'm', response: 'maybe' };
    assert.equal(resolve(event.date, [legacy]), 'maybe');
    assert.equal(resolve('2026-05-01', [legacy]), 'yes');
    assert.equal(resolve('2026-05-01', [], { ...event, cancelledDates: ['2026-05-01'] }), null);
    assert.equal(resolve('2026-05-01', [], { ...event, recurrence: 'none' }), null);
});
