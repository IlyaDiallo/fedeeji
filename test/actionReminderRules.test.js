const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAlert, ACTION_REPEAT_MS } = require('../src/backend/services/NotificationConfig');
const { reminderDue } = require('../src/backend/services/ActionNotificationScheduler');

const context = { states: ['Commencée'], memberIds: ['me'], members: [{ id: 'me' }] };
const base = { enabled: true, recipientMode: 'responsible', initialTime: '09:00' };
const due = (rule, previous, now, zone = 'Europe/Paris') => reminderDue(
    { ...base, stepReminders: [rule] }, 1, { timestamp: Date.parse(previous) },
    '2026-06-01', Date.parse(now), zone);

test('rules cover the final validation and reject invalid modes, times and delays', () => {
    for (const rule of [{ mode: 'fixed', time: '18:00' }, { mode: 'delay', minutes: 90 }]) {
        assert.deepEqual(normalizeAlert({ ...base, stepReminders: [rule] }, context).stepReminders, [rule]);
    }
    for (const rules of [[], [{ mode: 'fixed', time: '25:00' }], [{ mode: 'delay', minutes: -1 }],
        [{ mode: 'delay', minutes: 1.5 }], [{ mode: 'unknown' }], [null]]) {
        assert.throws(() => normalizeAlert({ ...base, stepReminders: rules }, context));
    }
    assert.throws(() => normalizeAlert({ ...base, initialTime: '', stepReminders: [] }, { ...context, states: [] }));
    assert.equal(ACTION_REPEAT_MS, 15 * 60000);
});

test('fixed time is same day before the hour, otherwise next day', () => {
    const rule = { mode: 'fixed', time: '18:00' };
    assert.equal(due(rule, '2026-06-01T14:00:00Z', '2026-06-01T15:59:00Z'), false);
    assert.equal(due(rule, '2026-06-01T14:00:00Z', '2026-06-01T16:00:00Z'), true);
    assert.equal(due(rule, '2026-06-01T17:00:00Z', '2026-06-02T15:59:00Z'), false);
    assert.equal(due(rule, '2026-06-01T17:00:00Z', '2026-06-02T16:00:00Z'), true);
    assert.equal(due(rule, '2026-06-01T16:00:00Z', '2026-06-01T16:01:00Z'), false);
});

test('fixed reminders follow local calendar days across month and DST boundaries', () => {
    const rule = { mode: 'fixed', time: '09:00' };
    assert.equal(due(rule, '2026-01-31T10:00:00Z', '2026-02-01T08:00:00Z'), true);
    assert.equal(due(rule, '2026-03-28T10:00:00Z', '2026-03-29T06:59:00Z'), false);
    assert.equal(due(rule, '2026-03-28T10:00:00Z', '2026-03-29T07:00:00Z'), true);
});

test('relative reminders use elapsed time since previous validation, not action time', () => {
    const rule = { mode: 'delay', minutes: 120 };
    assert.equal(due(rule, '2026-06-01T14:23:00Z', '2026-06-01T16:22:59Z'), false);
    assert.equal(due(rule, '2026-06-01T14:23:00Z', '2026-06-01T16:23:00Z'), true);
});
