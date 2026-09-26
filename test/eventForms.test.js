const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function context(extra = {}) {
    const sandbox = vm.createContext({
        AbstractView: class { constructor() { this.collectiveId = 'demo'; } setTitle() {} },
        t: key => key, escapeHtml: value => String(value), console, ...extra
    });
    for (const file of ['views/EventsView.js', 'ProgrammeRenderers.js']) {
        vm.runInContext(fs.readFileSync(`src/frontend/js/${file}`, 'utf8') + `\nthis.${file.split('/').at(-1).slice(0, -3)} = ${file.split('/').at(-1).slice(0, -3)};`, sandbox);
    }
    return sandbox;
}

test('event form offers type, assigned user, reminder mode and bounded advance', async () => {
    const c = context();
    const html = await new c.EventsView({}).getHtml();
    for (const id of ['event-type', 'event-memberId', 'event-reminder-mode', 'event-advance', 'event-alerts']) {
        assert.ok(html.includes(`id="${id}"`));
    }
    for (const mode of ['collective', 'individual', 'none', 'notification', 'alert']) {
        assert.ok(html.includes(`value="${mode}"`));
    }
    assert.ok(html.includes('min="0" max="527040" step="1"'));
});

test('event modal enables body scrolling while keeping its footer accessible', async () => {
    const c = context();
    const html = await new c.EventsView({}).getHtml();
    assert.match(html, /id="eventModal"\s+tabindex="-1">\s*<div class="modal-dialog modal-dialog-scrollable">/);
    assert.match(html, /<\/form>\s*<\/div>\s*<div class="modal-footer">/);
});

test('individual programme entries have no registration link; legacy events retain it', () => {
    const c = context();
    const render = data => c.ProgrammeRenderers.renderEventItem({
        item: { data: { id: 'e', name: 'RDV', ...data }, occurrence: { occurrenceDate: '2026-06-01' } },
        locale: 'fr-FR', collectiveId: 'demo'
    });
    assert.ok(!render({ type: 'individual', recurrence: 'weekly' }).includes('inscription'));
    assert.ok(render({}).includes('/inscriptions?eventId=e'));
    assert.ok(render({ recurrence: 'weekly' }).includes('/inscription-schedule'));
});

test('individual event table suppresses member registration and admin schedule links', () => {
    const rows = [];
    const c = context({ document: {
        getElementById() { return { innerHTML: '', appendChild: row => rows.push(row.innerHTML) }; },
        createElement() { return { innerHTML: '' }; }, querySelectorAll() { return []; }
    } });
    const view = new c.EventsView({});
    view.events = [{ id: 'e', name: 'RDV', type: 'individual', recurrence: 'weekly' }];
    view.isMember = true;
    view.renderTable();
    assert.ok(!rows[0].includes('inscription'));
    view.isMember = false;
    view.renderTable();
    assert.ok(!rows[1].includes('inscription'));
    assert.ok(rows[1].includes('btn-edit'));
});

test('programme offers event editing only to admins in list, now and calendar', () => {
    const c = context({ RecurrenceUtils: { formatDateStr: () => '2026-06-01' } });
    const item = { type: 'event', date: '2026-06-01',
        data: { id: 'e', name: 'RDV', type: 'individual' },
        occurrence: { occurrenceDate: '2026-06-01' } };
    for (const isMember of [true, false]) {
        const options = { isMember, collectiveId: 'demo', locale: 'fr-FR' };
        const htmls = [
            c.ProgrammeRenderers.renderEventItem({ ...options, item }),
            c.ProgrammeRenderers.renderNow({ ...options, items: [item] }),
            c.ProgrammeRenderers.renderCalendarGrid({ ...options, items: [item],
                startCal: new Date('2026-06-01T12:00:00'), endCal: new Date('2026-06-01T12:00:00'),
                viewMode: 'week', month: 5 })
        ];
        htmls.forEach(html => assert.equal(html.includes('btn-edit-event'), !isMember));
    }
});

test('embedded event editor preloads an existing event and updates rather than creates it', async () => {
    const elements = {};
    const element = id => elements[id] ||= { value: '', checked: false, style: {},
        reset() {}, reportValidity() { return true; },
        setAttribute() {}, removeAttribute() {} };
    let update;
    let shown = false;
    let refreshed = false;
    const c = context({ document: { getElementById: element, querySelectorAll: () => [] },
        api: { update: async (...args) => { update = args; } } });
    const editor = new c.EventsView({}, { embedded: true });
    editor.events = [{ id: 'e', name: 'Avant', date: '2026-06-01', allDay: true,
        recurrence: 'weekly', recurrenceDays: [1], reminder: { mode: 'none' } }];
    editor.modal = { show() { shown = true; }, hide() {} };
    editor.loadEvents = async () => { refreshed = true; };
    editor.openModal('e');
    assert.equal(shown, true);
    assert.equal(element('event-name').value, 'Avant');
    assert.equal(element('event-recurrence').value, 'weekly');
    element('event-name').value = 'Après';
    await editor.saveEvent();
    assert.equal(update[2], 'e');
    assert.equal(update[3].name, 'Après');
    assert.equal(refreshed, true);
});

test('individual reminders require a member and timed event; switching modes restores all-day choice', () => {
    const elements = {};
    const element = id => elements[id] ||= { value: '', style: {}, checked: false,
        setAttribute(key) { this[key] = true; }, removeAttribute(key) { this[key] = false; } };
    const c = context({ document: { getElementById: element } });
    const view = new c.EventsView({});
    element('event-type').value = 'individual';
    element('event-reminder-mode').value = 'alert';
    element('event-allDay-yes').checked = true;
    view.toggleEventOptions();
    assert.equal(element('event-memberId').required, true);
    assert.equal(element('event-allDay-yes').disabled, true);
    assert.equal(element('event-time').required, true);
    assert.equal(element('event-allDay-no').checked, true);
    element('event-type').value = 'collective';
    element('event-reminder-mode').value = 'none';
    view.toggleEventOptions();
    assert.equal(element('event-memberId').required, false);
    assert.equal(element('event-allDay-yes').disabled, false);
    assert.equal(element('event-advance-container').hidden, true);
});
