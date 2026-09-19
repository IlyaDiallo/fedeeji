const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ t: key => key, AbstractView: class {} });
context.window = context;
for (const file of ['RecurrenceUtils', 'ActionUtils', 'ActionOccurrenceResolver',
    'ProgrammeRenderers', 'views/ProgrammeView']) {
    const name = file.split('/').pop();
    vm.runInContext(fs.readFileSync(`src/frontend/js/${file}.js`, 'utf8')
        + `;this.${name} = ${name};`, context);
}
const renderers = context.ProgrammeRenderers;
renderers.renderActionIllustration = () => '<img alt="">';
const today = '2026-04-20';
const action = (id, date, extra = {}) => ({ id, name: id, date, recurrence: 'none', ...extra });
const collect = (actions, actionLogs = [], events = [], filter = 'all') =>
    context.ProgrammeView.prototype._collectNowItems.call({ actions, actionLogs, events }, filter, today);

test('now includes opened windows, excludes expired, future, done and cancelled', () => {
    const items = collect([
        action('open', '2026-04-23', { windowDays: 3 }),
        action('closed', '2026-04-24', { windowDays: 3 }),
        action('old', '2026-03-01'),
        action('done', today),
        action('cancelled', today, { cancelledDates: [today] }),
        action('partial', today, { states: ['Sortie'] })
    ], [
        { programmeId: 'done', date: today, type: 'done' },
        { programmeId: 'partial', date: today, type: 'done', state: 1 }
    ]);
    assert.deepEqual(Array.from(items, it => it.data.id), ['open', 'partial']);
    assert.equal(items[1].currentState, 1);
});

test('now keeps one overdue occurrence per recurring action and skips cancelled occurrences', () => {
    const items = collect([action('daily', '2026-04-01', {
        recurrence: 'daily', cancelledDates: ['2026-04-01']
    })]);
    assert.equal(items.length, 1);
    assert.equal(items[0].date, today);
    assert.equal(items[0].status, 'due');
});

test('now selects the immediately previous instance, never the oldest missed one', () => {
    const weekly = action('weekly', '2020-04-17', { recurrence: 'weekly', windowAfterDays: 3 });
    const items = collect([weekly]);
    assert.equal(items[0].date, '2026-04-17');
    assert.equal(items[0].status, 'overdue');
    assert.equal(collect([weekly], [{ programmeId: 'weekly', date: '2026-04-17' }]).length, 0);
});

test('now prioritizes an open window over missed past instances', () => {
    const weekly = action('weekly', '2026-04-03', { recurrence: 'weekly', windowDays: 4 });
    const items = collect([weekly]);
    assert.equal(items[0].date, '2026-04-24');
    assert.equal(items[0].status, 'due');
    assert.equal(collect([weekly], [{ programmeId: 'weekly', date: today,
        occurrenceDate: '2026-04-24' }]).length, 0);
});

test('now skips a cancelled latest instance and uses the preceding one', () => {
    const items = collect([action('weekly', '2026-04-03', {
        recurrence: 'weekly', cancelledDates: ['2026-04-17'], windowAfterDays: 10
    })]);
    assert.equal(items[0].date, '2026-04-10');
    assert.equal(items[0].status, 'overdue');
});

test('default window closes on deadline; an explicit extension is inclusive', () => {
    const previous = action('previous', '2026-04-19');
    assert.equal(collect([previous]).length, 0);
    const extended = { ...previous, windowAfterDays: 1 };
    assert.equal(collect([extended])[0].status, 'overdue');
    assert.equal(collect([{ ...previous, date: '2026-04-18', windowAfterDays: 1 }]).length, 0);
    assert.equal(collect([{ ...previous, states: ['Started'] }], [
        { programmeId: 'previous', date: previous.date, state: 1 }
    ]).length, 0);
    assert.equal(collect([extended], [{ programmeId: 'previous', date: previous.date }]).length, 0);
});

test('expired recurring instances do not hide the next available instance', () => {
    const weekly = action('weekly', '2026-04-03', { recurrence: 'weekly' });
    assert.equal(collect([weekly]).length, 0);
    const resolved = context.ActionOccurrenceResolver.resolveNextOccurrence({
        action: weekly, actionLogs: [], todayStr: today
    });
    assert.equal(resolved.nextDate, '2026-04-24');
    assert.equal(resolved.status, 'ok');
});

test('now includes only today events, including old recurring and cancelled events, respects filters', () => {
    const actions = [action('task', today)];
    const events = [action('daily event', '2020-01-01', { recurrence: 'daily', cancelledDates: [today] }),
        action('tomorrow', '2026-04-21')];
    const items = collect(actions, [], events);
    assert.equal(items.length, 2);
    assert.equal(items[1].occurrence.isCancelled, true);
    assert.equal(collect(actions, [], events, 'actions').length, 1);
    assert.equal(collect(actions, [], events, 'events')[0].type, 'event');
});

test('now shows only the current intermediate state, never the next step', () => {
    const states = ['Sortie <en cours>', 'Rentrée'];
    for (const [steps, currentState, expected] of [
        [[], 0, null],
        [states, 0, null],
        [states, 1, 'Sortie &lt;en cours&gt;'],
        [states, 2, 'Rentrée']
    ]) {
        const items = collect([action('task', today, { states: steps })],
            currentState ? [{ programmeId: 'task', date: today, type: 'done', state: currentState }] : []);
        const html = renderers.renderNow({ items, locale: 'fr', collectiveId: 'demo' });
        assert.doesNotMatch(html, /mark_done/);
        if (expected) {
            assert.ok(html.includes(`<span class="ms-auto text-success small">${expected}</span>`));
            assert.equal(html.split(expected).length - 1, 1);
        } else {
            assert.doesNotMatch(html, /ms-auto text-success small/);
        }
        if (currentState < 2) assert.doesNotMatch(html, /Rentrée/);
        if (currentState !== 1) assert.doesNotMatch(html, /Sortie/);
        assert.match(html, /action-item-cal/);
        assert.match(html, /data-id="task"/);
        assert.match(html, /btn-add-note-cal/);
    }
});

test('now renders sections by type, not date, and keeps occurrence-specific controls', () => {
    const items = collect([action('Lavabo <test>', today), action('old', '2026-03-01', { windowAfterDays: 50 })], [],
        [action('Réunion', today, { time: '10:00', cancelledDates: [today] })]);
    const html = renderers.renderNow({ items, locale: 'fr', collectiveId: 'demo' });
    assert.equal((html.match(/<section/g) || []).length, 2);
    assert.match(html, /available_actions/);
    assert.match(html, /today_events/);
    assert.ok(html.indexOf('2026-03-01') < html.indexOf(today));
    assert.match(html, /Lavabo &lt;test&gt;/);
    assert.match(html, /occurrence_cancelled/);
    assert.match(html, /10:00/);
    assert.match(html, /overdue/);
    const visibleText = html.replace(/<[^>]*>/g, '');
    assert.doesNotMatch(visibleText, /2026|mars|avr\./);
    assert.doesNotMatch(html, /btn-edit-action|btn-delete-action|last_done|window_days/);
    assert.match(renderers.renderNow({ items: [] }), /nothing_now/);
});
