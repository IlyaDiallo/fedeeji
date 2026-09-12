class AuthLinkView extends AbstractView {
    constructor(params) {
        super(params);
        this.token = params.authToken;
        this.purpose = params.authPurpose;
        this.setTitle(t('auth_confirm_title'));
    }
    async getHtml() {
        const valid = typeof this.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(this.token)
            && ['password', 'email'].includes(this.purpose);
        return `<div class="row justify-content-center"><div class="col-md-7 col-lg-5"><div class="card mt-5"><div class="card-body">
            <h5>${t('auth_confirm_title')}</h5>
            ${valid ? `<form id="auth-confirm-form">
                ${this.purpose === 'password' ? `<p>${t('auth_password_policy')}</p>
                    <label class="form-label" for="new-password">${t('password')}</label>
                    <input type="password" id="new-password" class="form-control mb-3" autocomplete="new-password" minlength="12" required>
                    <label class="form-label" for="repeat-password">${t('auth_repeat_password')}</label>
                    <input type="password" id="repeat-password" class="form-control mb-3" autocomplete="new-password" minlength="12" required>`
                    : `<p>${t('auth_email_confirm_hint')}</p>`}
                <button type="submit" class="btn btn-primary">${t('auth_confirm')}</button>
            </form>` : `<p>${t('auth_invalid_link')}</p>`}
            <div id="auth-link-message" class="mt-3" role="status" aria-live="polite"></div>
            <a class="d-inline-block mt-3" href="/${encodeURIComponent(this.collectiveId)}/login" id="auth-back" data-link>${t('back_to_login')}</a>
        </div></div></div></div>`;
    }
    async init() {
        document.getElementById('auth-confirm-form')?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.target;
            const message = document.getElementById('auth-link-message');
            const button = form.querySelector('button');
            message.textContent = '';
            button.disabled = true;
            try {
                if (this.purpose === 'password') {
                    const password = document.getElementById('new-password').value;
                    if (password !== document.getElementById('repeat-password').value) throw new Error(t('auth_password_mismatch'));
                    if ([...password].length < 12 || new TextEncoder().encode(password).length > 72) throw new Error(t('auth_password_policy'));
                    await api.confirmPassword({ collectiveId: this.collectiveId, token: this.token, password });
                } else await api.confirmEmail({ collectiveId: this.collectiveId, token: this.token });
                this.token = null;
                this.params.authToken = null;
                if (this.params.authLink) this.params.authLink.token = null;
                api.setToken(null); api.setUser(null);
                form.reset(); form.classList.add('d-none');
                message.textContent = t('auth_confirmed');
            } catch (error) { message.textContent = error.message; }
            finally { button.disabled = false; }
        });
    }
}
