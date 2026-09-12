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

test('now includes opened windows and old overdue actions, excludes future, done and cancelled', () => {
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
    assert.deepEqual(Array.from(items, it => it.data.id), ['open', 'old', 'partial']);
    assert.equal(items[2].currentState, 1);
});

test('now keeps one overdue occurrence per recurring action and skips cancelled occurrences', () => {
    const items = collect([action('daily', '2026-04-01', {
        recurrence: 'daily', cancelledDates: ['2026-04-01']
    })]);
    assert.equal(items.length, 1);
    assert.equal(items[0].date, '2026-04-02');
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

test('now renders sections by type, not date, and keeps occurrence-specific controls', () => {
    const items = collect([action('Lavabo <test>', today), action('old', '2026-03-01')], [],
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
    assert.doesNotMatch(html, /btn-edit-action|btn-delete-action|last_done|window_days/);
    assert.match(renderers.renderNow({ items: [] }), /nothing_now/);
});
