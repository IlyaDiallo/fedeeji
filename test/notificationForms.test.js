const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const elements = new Map();
    const getElementById = id => {
        if (!elements.has(id)) elements.set(id, { value: '', checked: false, style: {} });
        return elements.get(id);
    };
    const context = vm.createContext({
        t: key => key,
        IllustrationPicker: { defaultRecipe: () => ({ name: 'default' }) },
        ActionUtils: { DEFAULT_DURATION_UNIT: 'minutes' },
        document: { getElementById, querySelectorAll: selector => selector.includes('members')
            ? [{ value: 'member-a' }, { value: 'member-b' }]
            : [{ value: '30' }, { value: '120' }] }
    });
    vm.runInContext(fs.readFileSync('src/frontend/js/ActionFormManager.js', 'utf8') + '\nthis.Manager = ActionFormManager;', context);
    return { Manager: context.Manager, get: getElementById };
}

test('action alert form sends numeric delays and explicit opt-in', () => {
    const { Manager, get } = fixture();
    const manager = new Manager({ view: {} });
    assert.equal(manager._readAlert().enabled, false);
    get('action-alert-enabled').checked = true;
    get('action-alert-mode').value = 'selected';
    get('action-alert-time').value = '09:00';
    assert.deepEqual(JSON.parse(JSON.stringify(manager._readAlert())), {
        enabled: true, initialTime: '09:00', recipientMode: 'selected',
        memberIds: ['member-a', 'member-b'], stepDelayMinutes: [30, 120]
    });
});

test('template copies alert settings without implicitly enabling a new action', () => {
    const { Manager } = fixture();
    const template = { id: 'tpl', states: ['Lancée'], alert: {
        enabled: true, initialTime: '09:00', recipientMode: 'selected', memberIds: ['m'], stepDelayMinutes: [30]
    } };
    const manager = new Manager({ view: { actions: [template] } });
    let populated;
    manager._populateAlert = action => { populated = action; };
    manager._applyNormalizedRecurrence = () => {};
    manager.toggleAllDay = () => {};
    manager.toggleExecutionType = () => {};
    manager._onTemplateChange('tpl');
    assert.equal(populated.alert.enabled, false);
    assert.equal(populated.alert.initialTime, '09:00');
    assert.deepEqual(populated.alert.stepDelayMinutes, [30]);
    assert.equal(template.alert.enabled, true);
});

test('new alert form translation keys exist in French and English', () => {
    const { Manager } = fixture();
    const html = Manager.alertFieldsHtml();
    const context = vm.createContext({ localStorage: { getItem: () => 'fr' }, document: {} });
    const source = fs.readFileSync('src/frontend/js/i18n.js', 'utf8');
    const declaration = source.slice(0, source.indexOf('class I18n'));
    vm.runInContext(declaration + '\nthis.dictionary = translations;', context);
    for (const key of new Set(html.match(/ha_[a-z_]+/g))) {
        assert.ok(context.dictionary.fr[key], key);
        assert.ok(context.dictionary.en[key], key);
    }
});
