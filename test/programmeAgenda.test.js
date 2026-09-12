const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ t: key => key });
vm.runInContext(fs.readFileSync('src/frontend/js/ProgrammeRenderers.js', 'utf8')
    + ';this.renderers = ProgrammeRenderers;', context);
const renderers = context.renderers;
renderers.renderActionIllustration = () => '<img alt="">';
const action = (date, extra = {}) => ({
    type: 'action', date, data: { id: 'a1', name: 'Lavabo <test>' },
    currentState: 0, targetNotes: [], ...extra
});

test('agenda groups and sorts occurrences without configuration controls', () => {
    const html = renderers.renderAgenda({
        items: [action('2026-04-22'), action('2026-04-20'),
            action('2026-04-22', { isDone: true })], locale: 'fr', collectiveId: 'demo'
    });
    assert.equal((html.match(/<section/g) || []).length, 2);
    assert.ok(html.indexOf('2026-04-20') < html.indexOf('2026-04-22'));
    assert.equal((html.match(/data-date="2026-04-22"/g) || []).length, 4);
    assert.match(html, /Lavabo &lt;test&gt;/);
    assert.match(html, /bi-check-circle-fill/);
    assert.doesNotMatch(html, /btn-edit-action|btn-delete-action|last_done|window_days/);
});

test('agenda handles empty periods and cancelled events', () => {
    assert.match(renderers.renderAgenda({ items: [] }), /no_programme_items/);
    const html = renderers.renderAgenda({ items: [{
        type: 'event', date: '2026-04-20',
        data: { name: 'Réunion', time: '10:00' }, occurrence: { isCancelled: true }
    }], locale: 'fr', collectiveId: 'demo' });
    assert.match(html, /occurrence_cancelled/);
    assert.match(html, /10:00/);
    assert.match(html, /\/demo\/events/);
});
