const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { fixture } = require('./authHelpers');
const EmailService = require('../src/backend/services/EmailService');
const { createAuthRateLimit } = require('../src/backend/middleware/authRateLimit');

test('password links are hashed, expiring, scoped and single-use even concurrently', () => fixture(async ({ auth, sent, clock, putMembers }) => {
    await putMembers([{ id: 'a', email: 'a@example.org' }]);
    await auth.migrate('demo');
    const request = email => auth.requestPassword({ collectiveId: 'demo', email });
    assert.deepEqual(await request('unknown@example.org'), await request('a@example.org'));
    const first = sent.at(-1).token;
    assert.equal(JSON.stringify(await auth.state.read('demo')).includes(first), false);
    await request('a@example.org');
    const token = sent.at(-1).token;
    const confirm = (t, collectiveId = 'demo') => auth.confirmPassword({ collectiveId, token: t, password: 'a secure password' });
    await assert.rejects(confirm(first), /Lien/);
    await assert.rejects(confirm(token, 'other'), /Lien/);
    const results = await Promise.allSettled([confirm(token), confirm(token)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await bcrypt.compare('a secure password', (await auth.state.read('demo', 'a')).passwordHash), true);
    await request('a@example.org');
    clock.value += 31 * 60000;
    await assert.rejects(confirm(sent.at(-1).token), /Lien/);
    await assert.rejects(auth.confirmPassword({ collectiveId: 'demo', token, password: 'é'.repeat(37) }), /72/);
}));

test('email transport uses configured origin and escaped templates without network', async () => {
    const sent = [];
    const mail = new EmailService({ transport: { async sendMail(m) { sent.push(m); } },
        publicUrl: 'https://app.example.org', from: 'app@example.org', env: {} });
    await mail.sendLink({ to: 'user@example.org', collectiveId: 'demo', token: 'abc', purpose: 'password', lang: 'en' });
    assert.match(sent[0].text, /https:\/\/app.example.org\/demo\/auth-link#purpose=password&token=abc/);
    assert.match(sent[0].html, /&amp;token/);
    assert.throws(() => new EmailService({ publicUrl: 'http://app.example.org', env: { NODE_ENV: 'production' } }), /HTTPS/);
    assert.throws(() => new EmailService({ env: { NODE_ENV: 'production' } }), /Configuration/);
});

test('limiter has neutral email quota, independent IP quota and expiration', () => {
    let now = 0;
    const limit = createAuthRateLimit({ now: () => now })({ name: 'email', ip: 3, email: 1, windowMs: 100, neutral: true });
    function call(email) {
        const res = { code: 200, set() {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; } };
        limit({ ip: '1', body: { collectiveId: 'demo', email } }, res, () => { res.next = true; });
        return res;
    }
    assert.equal(call('a@example.org').next, true);
    assert.deepEqual(call('a@example.org').body, { success: true });
    assert.equal(call('b@example.org').next, true);
    assert.equal(call('c@example.org').code, 429);
    now = 101;
    assert.equal(call('a@example.org').next, true);
});
