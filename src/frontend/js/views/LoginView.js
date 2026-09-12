class LoginView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t('login_title'));
        this.collectiveId = params.collectiveId || null;
    }

    async getHtml() {
        let version;
        try { version = (await api.getVersion()).version; } catch { /* optional */ }
        return `<div class="row justify-content-center"><div class="col-md-7 col-lg-5">
            <div class="card mt-5"><div class="card-body">
                <h5 class="card-title text-center mb-4">${t(this.collectiveId ? 'login_title' : 'login_superadmin_title')}</h5>
                <form id="form-login">
                    ${this.collectiveId ? `<div class="mb-3"><label for="login-email" class="form-label">${t('email')}</label>
                        <input type="email" id="login-email" class="form-control" autocomplete="username" maxlength="254" required></div>` : ''}
                    <div class="mb-3"><label for="login-password" class="form-label">${t('password')}</label>
                        <input type="password" id="login-password" class="form-control" autocomplete="current-password" required></div>
                    <button type="submit" class="btn btn-primary w-100">${t('login_btn')}</button>
                    ${this.collectiveId ? `<button type="button" id="request-password" class="btn btn-link w-100 mt-2">${t('auth_password_request')}</button>
                        <p class="text-muted small">${t('auth_first_login')}</p>
                        <div class="text-center"><a href="/${encodeURIComponent(this.collectiveId)}/register" data-link>${t('register_request')}</a></div>` : ''}
                    <div id="login-message" role="status" aria-live="polite" class="mt-3"></div>
                </form>
            </div>${version ? `<div class="card-footer text-center text-muted small">v${escapeHtml(version)}</div>` : ''}</div>
        </div></div>`;
    }

    postLoginTarget(defaultUrl) {
        const raw = localStorage.getItem('redirectAfterLogin');
        localStorage.removeItem('redirectAfterLogin');
        let stored;
        try { stored = JSON.parse(raw); } catch { return defaultUrl; }
        if (!stored?.path || typeof stored.path !== 'string'
            || !stored.path.startsWith('/') || stored.path.startsWith('//') || stored.path.includes('\\')) return defaultUrl;
        if (stored.user && stored.user !== api.getUserKey()) return defaultUrl;
        return stored.path;
    }

    async init() {
        const form = document.getElementById('form-login');
        const message = document.getElementById('login-message');
        const busy = value => form.querySelectorAll('button').forEach(button => { button.disabled = value; });
        form.addEventListener('submit', async event => {
            event.preventDefault(); message.textContent = ''; busy(true);
            try {
                const password = document.getElementById('login-password').value;
                if (this.collectiveId) {
                    await api.loginCollective({ collectiveId: this.collectiveId,
                        email: document.getElementById('login-email').value, password });
                } else await api.login(password);
                navigateTo(this.postLoginTarget(this.collectiveId ? `/${this.collectiveId}` : '/'));
            } catch (error) { message.textContent = error.message; }
            finally { busy(false); }
        });
        document.getElementById('request-password')?.addEventListener('click', async () => {
            const email = document.getElementById('login-email');
            if (!email.reportValidity()) return;
            message.textContent = ''; busy(true);
            try {
                await api.requestPassword({ collectiveId: this.collectiveId, email: email.value, lang: i18n.lang });
                message.textContent = t('auth_link_sent');
            } catch (error) { message.textContent = error.message; }
            finally { busy(false); }
        });
    }
}
