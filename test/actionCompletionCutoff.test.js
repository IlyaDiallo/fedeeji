const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Scheduler = require('../src/backend/services/ActionNotificationScheduler');

const context = vm.createContext({ t: key => key });
context.window = context;
for (const name of ['RecurrenceUtils', 'ActionOccurrenceResolver', 'ProgrammeRenderers']) {
    vm.runInContext(fs.readFileSync(`src/frontend/js/${name}.js`, 'utf8')
        + `;this.${name} = ${name};`, context);
}
const resolver = context.ActionOccurrenceResolver;
const action = { id: 'task', name: 'Task', date: '2026-05-01', recurrence: 'weekly' };
const resolve = (actionLogs, todayStr = '2026-05-09', task = action) =>
    resolver.resolveNextOccurrence({ action: task, actionLogs, todayStr });
const log = extra => ({ programmeId: 'task', type: 'done', date: '2026-05-08', ...extra });

for (const occurrenceDate of ['2026-05-01', '2026-05-08']) {
    test(`completion on May 8 clears earlier deadlines (instance ${occurrenceDate})`, () => {
        const logs = [log({ occurrenceDate })];
        const item = resolve(logs);
        assert.equal(item.nextDate, '2026-05-15');
        assert.equal(item.status, 'ok');
        assert.equal(resolve(logs, '2026-05-16').status, 'overdue');
        assert.equal(Scheduler.nextOccurrence(action, logs), '2026-05-15');
        const range = resolver.resolveOccurrencesInRange({ action, actionLogs: logs,
            startStr: '2026-05-01', endStr: '2026-05-15' });
        assert.ok(range.every(it => it.isDone || it.date > '2026-05-08'));
        assert.ok(range.some(it => it.date === occurrenceDate && it.isDone));
    });
}

test('completion in advance skips the completed instance, not the next one', () => {
    const logs = [log({ date: '2026-05-06', occurrenceDate: '2026-05-08' })];
    assert.equal(resolve(logs).nextDate, '2026-05-15');
    assert.equal(Scheduler.nextOccurrence(action, logs), '2026-05-15');
});

test('notes and intermediate states do not clear overdue instances', () => {
    const task = { ...action, states: ['Started'] };
    const logs = [log({ type: 'note' }), log({ state: 1 })];
    assert.equal(resolve(logs, undefined, task).nextDate, '2026-05-01');
    assert.equal(Scheduler.nextOccurrence(task, logs), '2026-05-01');
});

test('a reverted completion no longer clears older instances', () => {
    const logs = [log({ state: 1, timestamp: 1 }), log({ state: 0, timestamp: 2 })];
    assert.equal(resolve(logs).nextDate, '2026-05-01');
    assert.equal(Scheduler.nextOccurrence(action, logs), '2026-05-01');
});

test('completed one-off and last recurring instances are not proposed again', () => {
    const logs = [log({ occurrenceDate: '2026-05-08' })];
    assert.equal(resolve(logs, '2026-05-08', { ...action, recurrenceEndDate: '2026-05-08' }), null);
    assert.equal(resolve(logs, '2026-05-08', { ...action, recurrence: 'none', date: '2026-05-08' }), null);
});

test('list and now render no last completion date', () => {
    const item = resolve([log({})]);
    const renderers = context.ProgrammeRenderers;
    renderers.renderActionIllustration = () => '';
    const params = { locale: 'fr', collectiveId: 'demo' };
    const html = renderers.renderActionItem({ ...params, item, getMemberName: () => 'Member' })
        + renderers.renderNow({ ...params, items: [{ ...item, date: item.nextDate }] });
    assert.doesNotMatch(html, /last_done|never_done|2026-05-08/);
});
