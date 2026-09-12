const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, { value: '', textContent: '', handlers: {}, disabled: false,
            classList: { add() {} }, addEventListener(name, fn) { this.handlers[name] = fn; },
            querySelector() { return get('submit'); }, querySelectorAll() { return [get('submit')]; },
            reset() { this.resetDone = true; }, reportValidity() { return true; } });
        return elements.get(id);
    };
    const calls = [];
    const api = { getRole: () => 'member', getVersion: async () => ({ version: '1' }), getUserKey: () => 'demo:a',
        setToken: value => calls.push(['token', value]), setUser: value => calls.push(['user', value]),
        loginCollective: async value => calls.push(['login', value]),
        confirmPassword: async value => calls.push(['confirm', value]), requestPassword: async value => calls.push(['request', value]) };
    const context = vm.createContext({ api, i18n: { lang: 'fr' }, t: key => key, escapeHtml: String,
        localStorage: { getItem: () => null, removeItem() {} }, TextEncoder,
        document: { getElementById: get }, navigateTo: value => calls.push(['navigate', value]) });
    for (const name of ['AbstractView', 'LoginView', 'AuthLinkView', 'MembersView']) {
        vm.runInContext(fs.readFileSync(`src/frontend/js/views/${name}.js`, 'utf8') + `\nthis.${name} = ${name};`, context);
    }
    return { context, get, calls };
}

test('one collective form, no role tabs, setup request does not need password', async () => {
    const { context, get, calls } = fixture();
    const view = new context.LoginView({ collectiveId: 'demo' });
    const html = await view.getHtml();
    assert.match(html, /autocomplete="username"/);
    assert.match(html, /autocomplete="current-password"/);
    assert.doesNotMatch(html, /panel-admin|panel-member|nav-tabs/);
    await view.init();
    get('login-email').value = 'a@example.org';
    await get('request-password').handlers.click();
    assert.equal(calls[0][0], 'request');
    assert.equal(get('login-message').textContent, 'auth_link_sent');
    const globalHtml = await new context.LoginView({}).getHtml();
    assert.doesNotMatch(globalHtml, /id="login-email"|id="request-password"/);
    assert.match(globalHtml, /login_superadmin_title/);
});

test('password confirmation validates matching fields then clears session without auto login', async () => {
    const { context, get, calls } = fixture();
    const view = new context.AuthLinkView({ collectiveId: 'demo', authToken: 'a'.repeat(43), authPurpose: 'password' });
    assert.match(await view.getHtml(), /autocomplete="new-password"/);
    await view.init();
    get('new-password').value = 'secure test password';
    get('repeat-password').value = 'other';
    const form = get('auth-confirm-form');
    await form.handlers.submit({ preventDefault() {}, target: form });
    assert.equal(get('auth-link-message').textContent, 'auth_password_mismatch');
    assert.equal(calls.length, 0);
    get('repeat-password').value = 'secure test password';
    await form.handlers.submit({ preventDefault() {}, target: form });
    assert.deepEqual(calls.map(c => c[0]), ['confirm', 'token', 'user']);
    assert.equal(view.token, null);
    assert.equal(form.resetDone, true);
});

test('member form replaces admin password with invitation and confirmed email fields', () => {
    const { context } = fixture();
    const view = new context.MembersView({ collectiveId: 'demo' });
    const html = view._getMembersHtml();
    assert.doesNotMatch(html, /adminPassword|admin-password-group/);
    assert.match(html, /member-invite/);
    assert.match(html, /pending-email/);
});

test('all auth labels exist in French and English; router removes fragment before fetching', () => {
    const ctx = vm.createContext({});
    const i18n = fs.readFileSync('src/frontend/js/i18n.js', 'utf8');
    vm.runInContext(i18n.slice(0, i18n.indexOf('class I18n')) + '\nthis.dict = translations;', ctx);
    const files = ['LoginView', 'AuthLinkView', 'MembersView'].map(name => fs.readFileSync(`src/frontend/js/views/${name}.js`, 'utf8')).join('\n');
    for (const key of new Set(files.match(/auth_[a-z_]+/g))) {
        assert.ok(ctx.dict.fr[key], key); assert.ok(ctx.dict.en[key], key);
    }
    const source = fs.readFileSync('src/frontend/js/app.js', 'utf8');
    assert.ok(source.indexOf("history.replaceState(null, '', location.pathname)") < source.indexOf('await fetchOrgName(newOrgId)'));
    assert.match(source, /isLoginRoute && !isAuthLink/);
});
