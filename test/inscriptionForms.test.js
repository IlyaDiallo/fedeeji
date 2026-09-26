const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Utils = require('../src/frontend/js/InscriptionUtils');
const RecurrenceUtils = require('../src/frontend/js/RecurrenceUtils');
function fixture() {
    const elements = new Map();
    const requests = [];
    const c = vm.createContext({
        AbstractView: class { constructor() { this.collectiveId = 'c'; this.isMember = true; } setTitle() {} },
        t: k => k, InscriptionUtils: Utils, RecurrenceUtils, window: { RecurrenceUtils },
        api: { getMemberId: () => 'm', request: async (url, payload) => requests.push(JSON.parse(payload.body)), get: async () => [] },
        document: { getElementById: id => { if (!elements.has(id)) elements.set(id, { disabled: false, classList: { toggle() {} } }); return elements.get(id); } },
        alert: message => { throw new Error(message); }, confirm: () => true
    });
    for (const name of ['InscriptionScheduleView', 'InscriptionsView']) {
        vm.runInContext(fs.readFileSync(`src/frontend/js/views/${name}.js`, 'utf8') + `\nthis.${name} = ${name}`, c);
    }
    const view = new c.InscriptionScheduleView({ eventId: 'e' });
    view.event = { id: 'e', date: '2026-01-01', recurrence: 'daily' };
    view.inscriptions = [{ scope: 'series', eventId: 'e', memberId: 'm', periods: [{ startsOn: '2026-01-01', endsBefore: null }] }];
    view.renderMonth = () => {};
    return { c, view, requests };
}
test('forms distinguish series registration from displayed-date bulk operations', async () => {
    const { c, view } = fixture();
    const html = await view.getHtml();
    assert.match(html, /btn-series-registration/);
    assert.match(html, /apply_displayed/);
    assert.match(html, /data-brush="reset"/);
    const form = await new c.InscriptionsView({}).getHtml();
    assert.match(form, /inscription-scope/);
    assert.match(form, /inscription-series-members/);
});
test('inherited responses are visible but only changed exceptions are saved', async () => {
    const { view, requests } = fixture();
    view.loadLocalResponses();
    assert.equal(view.responseFor('2040-01-01'), 'yes');
    assert.match(view.inheritedMark('2040-01-01'), /series_inherited/);
    assert.equal(Object.keys(view.localResponses).length, 0);
    view.activeBrush = 'no';
    view.toggleResponse('2040-01-01');
    assert.equal(view.responseFor('2040-01-01'), 'no');
    assert.equal(view.inheritedMark('2040-01-01'), '');
    await view.save();
    assert.deepEqual(requests[0].entries, [{ occurrenceDate: '2040-01-01', response: 'no' }]);
});
test('multi-member registration reports partial failure and keeps the modal open for retry', async () => {
    const { c } = fixture();
    const view = new c.InscriptionsView({});
    view.isMember = false;
    view.seriesPicker = { entries: ['m', 'other'].map(value => ({ input: { value, checked: true } })) };
    for (const [id, value] of Object.entries({ 'inscription-id': '', 'inscription-eventId': 'e',
        'inscription-memberId': '', 'inscription-response': 'yes', 'inscription-scope': 'series' })) {
        c.document.getElementById(id).value = value;
    }
    let hidden = false;
    const alerts = [];
    c.alert = message => alerts.push(message);
    c.api.request = async (url, payload) => { if (JSON.parse(payload.body).memberId === 'other') throw Error('failure'); };
    view.modal = { hide() { hidden = true; } };
    await view.saveInscription();
    assert.equal(hidden, false);
    assert.match(alerts[0], /series_partial_error/);
});

test('reset restores inheritance, month navigation reaches distant occurrences, switching resets edits', () => {
    const { view } = fixture();
    view.inscriptions.push({ eventId: 'e', memberId: 'm', occurrenceDate: '2040-01-01', response: 'no' });
    view.activeBrush = 'reset';
    view.toggleResponse('2040-01-01');
    assert.equal(view.responseFor('2040-01-01'), 'yes');
    view.currentMonth = new Date('2040-01-01T12:00:00');
    assert.equal(view.getMonthOccurrences().length, 31);
    view.selectedMemberId = 'other';
    view.loadLocalResponses();
    assert.equal(view.dirty, false);
    assert.equal(Object.keys(view.localResponses).length, 0);
    assert.equal(view.responseFor('2040-01-01'), null);
});
