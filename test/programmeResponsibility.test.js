const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
    const context = vm.createContext({
        t: key => key, URLSearchParams,
        api: { getMemberId: () => 'alice', getUserOrgId: () => 'demo' },
        AbstractView: class {}
    });
    context.window = context;
    for (const file of ['RecurrenceUtils', 'IllustrationPicker', 'ProgrammeRenderers', 'views/ProgrammeView']) {
        const name = file.split('/').pop();
        vm.runInContext(fs.readFileSync(`src/frontend/js/${file}.js`, 'utf8')
            + `;this.${name} = ${name};`, context);
    }
    return context;
}

const cases = [
    ['sole', { memberIds: ['alice'] }, 'alice', 'person', 'action_you_own'],
    ['shared', { memberIds: ['bob', 'alice'] }, 'alice', 'people', 'action_you_coown'],
    ['duplicates', { memberIds: ['alice', 'alice', null, ''] }, 'alice', 'person', 'action_you_own'],
    ['other member', { memberIds: ['bob'] }, 'alice'],
    ['no identity', { memberIds: ['alice'] }, null],
    ['legacy', { memberId: 'alice' }, 'alice', 'person', 'action_you_own'],
    ['empty overrides legacy', { memberIds: [], memberId: 'alice' }, 'alice'],
    ['missing owners', {}, 'alice']
];

for (const [name, owners, currentMemberId, icon, label] of cases) {
    test(`ownership in every programme view: ${name}`, () => {
        const { ProgrammeRenderers: r } = load();
        const date = '2026-04-20';
        const item = {
            type: 'action', data: { id: 'a1', name: 'Task', date, ...owners },
            date, occurrence: { occurrenceDate: date }, status: 'due'
        };
        const common = { collectiveId: 'demo', currentMemberId, locale: 'fr' };
        const results = [
            r.renderActionItem({ ...common, item, isMember: true }),
            r.renderNow({ ...common, items: [item] }),
            ...['week', 'month'].map(viewMode => r.renderCalendarGrid({
                ...common, items: [item], viewMode, month: 3,
                startCal: new Date(`${date}T12:00:00`), endCal: new Date(`${date}T12:00:00`)
            }))
        ];
        for (const html of results) {
            if (icon) {
                assert.match(html, new RegExp(`bi-${icon}-fill`));
                assert.match(html, new RegExp(`role="img" aria-label="${label}" title="${label}"`));
                assert.equal((html.match(/action-ownership-marker/g) || []).length, 1);
                assert.doesNotMatch(html, new RegExp(`>\\s*${label}\\s*<`));
            } else {
                assert.doesNotMatch(html, /action-ownership-marker/);
            }
        }
    });
}

test('identity is collective-scoped and independent of role', () => {
    const context = load();
    const getter = Object.getOwnPropertyDescriptor(context.ProgrammeView.prototype, 'currentMemberId').get;
    for (const isMember of [true, false]) {
        assert.equal(getter.call({ collectiveId: 'demo', isMember }), 'alice');
        assert.equal(getter.call({ collectiveId: 'other', isMember }), null);
    }
    context.api.getMemberId = () => null;
    assert.equal(getter.call({ collectiveId: 'demo' }), null);
});

test('events and ordinary illustrations never receive an ownership marker', () => {
    const { ProgrammeRenderers: r } = load();
    const data = { id: 'e1', name: 'Event', memberIds: ['alice'] };
    const item = { type: 'event', data, date: '2026-04-20', occurrence: { occurrenceDate: '2026-04-20' } };
    const common = { collectiveId: 'demo', currentMemberId: 'alice', locale: 'fr' };
    for (const html of [
        r.renderEventItem({ ...common, item }),
        r.renderNow({ ...common, items: [item] }),
        r.renderCalendarGrid({ ...common, items: [item], viewMode: 'week', month: 3,
            startCal: new Date('2026-04-20T12:00:00'), endCal: new Date('2026-04-20T12:00:00') }),
        r.renderActionIllustration(data, 'demo', 'task-icon'),
        r.renderOwnedActionIllustration(data, 'demo', 'task-icon')
    ]) assert.doesNotMatch(html, /action-ownership-marker/);
});
