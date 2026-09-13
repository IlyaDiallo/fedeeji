const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const RecurrenceUtils = require('../src/frontend/js/RecurrenceUtils');
const Progress = require('../src/backend/services/ActionProgressService');
const createLogsRouter = require('../src/backend/routes/actionLogs');
const createActionsRouter = require('../src/backend/routes/actions');

const action = { id: 'a', date: '2026-05-08', recurrence: 'none' };

test('inclusive window handles month/year boundaries and defaults', () => {
    assert.deepEqual(RecurrenceUtils.actionWindow({}, action.date), { start: action.date, end: action.date });
    assert.deepEqual(RecurrenceUtils.actionWindow({ windowDays: 2, windowAfterDays: 1 }, '2026-01-01'),
        { start: '2025-12-30', end: '2026-01-02' });
    assert.deepEqual(RecurrenceUtils.actionWindow({ windowDays: 1, windowAfterDays: 1 }, '2026-03-29'),
        { start: '2026-03-28', end: '2026-03-30' });
    const extended = { windowDays: 2, windowAfterDays: 1 };
    for (const date of ['2026-05-06', '2026-05-08', '2026-05-09']) {
        assert.equal(RecurrenceUtils.isInActionWindow(extended, action.date, date), true);
    }
    for (const date of ['2026-05-05', '2026-05-10']) {
        assert.equal(RecurrenceUtils.isInActionWindow(extended, action.date, date), false);
    }
});

test('expired definitions remain editable in settings, but absent from now', () => {
    const params = { action, todayStr: '2026-05-09' };
    assert.equal(RecurrenceUtils.nextActionOccurrence(params), null);
    assert.equal(RecurrenceUtils.nextActionOccurrence({ ...params, includeExpired: true }).occurrenceDate, action.date);
});

test('log modal makes expired instances read-only for members and editable for administrators', () => {
    const context = vm.createContext({ RecurrenceUtils, document: { getElementById: () => ({}) } });
    vm.runInContext(fs.readFileSync('src/frontend/js/LogFormManager.js', 'utf8')
        + ';this.LogFormManager = LogFormManager;', context);
    const today = RecurrenceUtils.formatDateStr(new Date());
    const yesterday = new Date(`${today}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const date = RecurrenceUtils.formatDateStr(yesterday);
    for (const isMember of [true, false]) {
        let mode;
        const task = { ...action, date };
        const form = new context.LogFormManager({ view: { actions: [task], isMember } });
        form.setActionIdentity = () => {};
        form.resetVisibility = () => {};
        form._openReadOnlyMode = () => { mode = 'readonly'; };
        form._openDoneMode = () => { mode = 'done'; };
        form.open('a', 'done', date);
        assert.equal(mode, isMember ? 'readonly' : 'done');
        task.windowAfterDays = 1;
        form.open('a', 'done', date);
        assert.equal(mode, 'done');
    }
});

test('API validates both window fields and trusts only the authenticated role for corrections', async () => {
    let stored = { ...action };
    const logs = [];
    const dataService = {
        list: async ({ collection }) => collection === 'action-logs' ? logs : [],
        get: async ({ collection, id }) => collection === 'actions' ? stored : logs.find(l => l.id === id),
        create: async ({ collection, data }) => {
            if (collection === 'actions') return (stored = { ...data, id: 'a' });
            const log = { ...data, id: String(logs.length + 1) }; logs.push(log); return log;
        },
        update: async ({ data }) => (stored = { ...stored, ...data })
    };
    const progressService = new Progress({ dataService,
        now: () => Date.parse('2026-05-09T12:00:00Z'),
        notificationState: { getSettings: async () => ({ timeZone: 'UTC' }), revokeTokens: async () => {} }
    });
    const app = express();
    app.use(express.json());
    // Simulated verified identity: request-body roles must have no effect.
    app.use((req, res, next) => {
        req.user = { role: req.headers['x-test-role'] || 'member', collectiveId: 'demo', memberId: 'm' };
        req.collectiveId = 'demo'; next();
    });
    app.use('/actions', createActionsRouter({ dataService, illustrationService: { normalizeRecipe: () => ({}) } }));
    app.use('/logs', createLogsRouter({ dataService, progressService }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const send = (path, method, body, role = 'member') => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method, headers: { 'content-type': 'application/json', 'x-test-role': role }, body: JSON.stringify(body)
    });
    try {
        for (const key of ['windowDays', 'windowAfterDays']) {
            for (const value of [-1, 1.5, '2', null]) {
                assert.equal((await send('/actions/a', 'PUT', { [key]: value }, 'admin')).status, 400);
            }
        }
        assert.equal((await send('/actions/a', 'PUT', { windowAfterDays: 2 }, 'admin')).status, 200);
        assert.equal(stored.windowAfterDays, 2);
        assert.equal((await send('/actions', 'POST', action, 'admin')).status, 201);
        assert.equal(stored.windowDays, 0);
        assert.equal(stored.windowAfterDays, 0);
        const body = { programmeId: 'a', date: action.date, occurrenceDate: action.date,
            type: 'done', memberId: 'm', role: 'admin', adminCorrection: true };
        assert.equal((await send('/logs', 'POST', body)).status, 400);
        assert.equal(logs.length, 0);
        assert.equal((await send('/logs', 'POST', body, 'admin')).status, 201);
        assert.equal(logs.length, 1);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
