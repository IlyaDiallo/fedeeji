const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const createActionsRouter = require('../src/backend/routes/actions');
const IllustrationService = require(
    '../src/backend/services/IllustrationService'
);

async function withServer(run) {
    let created;
    const dataService = {
        async create({ data }) {
            created = { ...data, id: 'created-id' };
            return created;
        },
        async update({ data, id }) { return { ...data, id }; },
        async list() { return []; },
        async get() { return null; },
        async delete() {}
    };
    const app = express();
    app.use(express.json());
    app.use('/api/:collectiveId/actions', (req, res, next) => {
        req.collectiveId = req.params.collectiveId;
        req.user = { role: 'admin', collectiveId: req.params.collectiveId };
        next();
    }, createActionsRouter({
        dataService,
        illustrationService: new IllustrationService()
    }));
    const server = await new Promise(resolve => {
        const listening = app.listen(0, () => resolve(listening));
    });
    try {
        const port = server.address().port;
        await run(`http://127.0.0.1:${port}`, () => created);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test('new actions always receive a validated illustration recipe', async () => {
    await withServer(async (base, getCreated) => {
        const response = await fetch(`${base}/api/demo/actions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Lessive' })
        });
        assert.equal(response.status, 201);
        assert.deepEqual(getCreated().illustration, {
            collection: 'tabler',
            name: 'clipboard-check',
            style: 'doodle-v1',
            seed: new IllustrationService().seedFrom('Lessive')
        });
    });
});

test('action API rejects recipes outside the embedded catalogue', async () => {
    await withServer(async base => {
        const response = await fetch(`${base}/api/demo/actions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Hostile',
                illustration: {
                    collection: 'tabler',
                    name: '../outside',
                    style: 'doodle-v1',
                    seed: 1
                }
            })
        });
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /Illustration inconnue/);
    });
});
