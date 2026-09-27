const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('src/frontend/js/ProgrammeRenderers.js', 'utf8')
    + '\nthis.Renderers = ProgrammeRenderers;', context);
const compare = context.Renderers.compareItems;

test('events by hour, own actions, collective actions, then others; action times ignored', () => {
    const items = [
        { type: 'action', data: { id: 'other', memberIds: ['b'], time: '01:00' } },
        { type: 'action', data: { id: 'collective', memberIds: [], time: '02:00' } },
        { type: 'action', data: { id: 'mine', memberIds: ['a'], time: '23:00' } },
        { type: 'event', data: { id: 'late', time: '20:00' } },
        { type: 'action', data: { id: 'shared', memberIds: ['b', 'a'], time: '03:00' } },
        { type: 'event', data: { id: 'early', time: '08:00' } },
        { type: 'action', data: { id: 'legacy', memberId: 'a' } }
    ];
    assert.deepEqual(items.sort((a, b) => compare(a, b, 'a')).map(i => i.data.id),
        ['early', 'late', 'mine', 'shared', 'legacy', 'collective', 'other']);
});

test('without a logged-in member collective actions precede assigned actions', () => {
    const collective = { type: 'action', data: { memberIds: [], memberId: 'old' } };
    const assigned = { type: 'action', data: { memberId: 'a' } };
    assert.ok(compare(collective, assigned, null) < 0);
});

test('action editor no longer exposes start time or all-day options', () => {
    const source = fs.readFileSync('src/frontend/js/views/ProgrammeView.js', 'utf8');
    assert.doesNotMatch(source, /id="action-(?:time|allDay-yes|allDay-no)"/);
    assert.match(source, /id="action-duration"/);
});
