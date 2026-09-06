const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAlert, normalizeSettings, recipientIds, buildWebhookUrl } =
    require('../src/backend/services/NotificationConfig');

const context = { states: ['Lancée', 'Séchée'], memberId: 'a', members: [{ id: 'a' }, { id: 'b' }] };
const alert = { enabled: true, initialTime: '09:00', recipientMode: 'selected', memberIds: ['a', 'b', 'a'], stepDelayMinutes: [30, 120] };
const settings = { timeZone: 'Europe/Paris', quietStart: '22:00', quietEnd: '08:00', allowedOrigins: ['https://ha.example.org/'] };

test('historical and explicitly disabled alerts remain opt-out', () => {
    assert.deepEqual(normalizeAlert(undefined), { enabled: false });
    assert.deepEqual(normalizeAlert({ enabled: false, memberIds: ['invalid'] }), { enabled: false });
    assert.deepEqual(recipientIds({}), []);
    assert.throws(() => normalizeAlert({ enabled: 'true' }));
});

test('configuration has one delay per transition including the implicit final state', () => {
    const result = normalizeAlert(alert, context);
    assert.equal(result.version, 1);
    assert.deepEqual(result.memberIds, ['a', 'b']);
    assert.deepEqual(result.stepDelayMinutes, [30, 120]);
    for (const delays of [[30], [30, -1], [30, 0.5], [30, '120'], [30, 527041]]) {
        assert.throws(() => normalizeAlert({ ...alert, stepDelayMinutes: delays }, context));
    }
    assert.deepEqual(normalizeAlert({ ...alert, stepDelayMinutes: [] }, { ...context, states: [] }).stepDelayMinutes, []);
});

test('recipients must exist in the collective; never broadcast by fallback', () => {
    for (const memberIds of [[], ['stranger'], [null]]) {
        assert.throws(() => normalizeAlert({ ...alert, memberIds }, context));
    }
    const result = normalizeAlert({ ...alert, recipientMode: 'responsible' }, context);
    assert.deepEqual(result.memberIds, []);
    assert.deepEqual(recipientIds({ alert: result, memberId: 'a' }), ['a']);
    assert.deepEqual(recipientIds({ alert: result }), []);
    assert.throws(() => normalizeAlert({ ...alert, recipientMode: 'responsible' }, { ...context, memberId: null }));
});

test('settings require an explicit zone, quiet hours and bounded origins', () => {
    assert.deepEqual(normalizeSettings(settings).allowedOrigins, ['https://ha.example.org']);
    for (const patch of [
        { timeZone: 'Unknown/Zone' }, { timeZone: null }, { quietStart: '24:00' },
        { quietStart: '08:00' }, { allowedOrigins: [] },
        { allowedOrigins: ['file:///etc/passwd'] },
        { allowedOrigins: ['https://user:pass@example.org'] },
        { allowedOrigins: ['https://ha.example.org/path'] },
        { insecureTlsOrigins: ['https://other.example.org'] }
    ]) assert.throws(() => normalizeSettings({ ...settings, ...patch }));
});

test('webhook builder preserves legacy URLs and encodes IDs', () => {
    assert.equal(buildWebhookUrl({ haWebhookUrl: 'https://ha/api/webhook/old' }), 'https://ha/api/webhook/old');
    assert.equal(buildWebhookUrl({ haBaseUrl: 'https://ha/', haWebhookId: 'a/b' }), 'https://ha/api/webhook/a%2Fb');
    assert.equal(buildWebhookUrl(null), null);
});
