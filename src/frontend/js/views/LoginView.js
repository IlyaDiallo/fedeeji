class LoginView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("login_title"));
        this.orgId = params.orgId || null;
    }

    async getHtml() {
        // Sans orgId dans l'URL : formulaire superadmin uniquement
        if (!this.orgId) {
            return this.getSuperadminHtml();
        }
        // Avec orgId dans l'URL : onglets Membre / Admin
        return this.getOrgLoginHtml();
    }

    /** HTML pour le login superadmin (sans org) */
    getSuperadminHtml() {
        return `
            <div class="row justify-content-center">
                <div class="col-md-7 col-lg-5">
                    <div class="card mt-5">
                        <div class="card-body">
                            <h5 class="card-title text-center mb-4"
                                data-i18n="login_admin_title">
                                ${t("login_admin_title")}</h5>
                            <form id="form-admin-login">
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="password">
                                        ${t("password")}</label>
                                    <input type="password"
                                        class="form-control"
                                        id="admin-password"
                                        required>
                                </div>
                                <div class="d-grid">
                                    <button type="submit"
                                        class="btn btn-primary"
                                        data-i18n="login_btn">
                                        ${t("login_btn")}</button>
                                </div>
                                <div id="admin-login-error"
                                    class="text-danger mt-3
                                        text-center d-none">
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /** HTML pour le login membre/admin (avec org dans l'URL) */
    getOrgLoginHtml() {
        return `
            <div class="row justify-content-center">
                <div class="col-md-7 col-lg-5">
                    <div class="card mt-5">
                        <div class="card-header">
                            <ul class="nav nav-tabs
                                card-header-tabs"
                                id="login-tabs" role="tablist">
                                <li class="nav-item"
                                    role="presentation">
                                    <button class="nav-link active"
                                        id="tab-member"
                                        data-bs-toggle="tab"
                                        data-bs-target="#panel-member"
                                        type="button" role="tab"
                                        data-i18n="member">
                                        ${t("member")}</button>
                                </li>
                                <li class="nav-item"
                                    role="presentation">
                                    <button class="nav-link"
                                        id="tab-admin"
                                        data-bs-toggle="tab"
                                        data-bs-target="#panel-admin"
                                        type="button" role="tab">
                                        Admin</button>
                                </li>
                            </ul>
                        </div>
                        <div class="card-body">
                            <div class="tab-content">

                                <!-- Onglet Membre -->
                                <div class="tab-pane fade show active"
                                    id="panel-member" role="tabpanel">
                                    <h5 class="card-title
                                        text-center mb-4"
                                        data-i18n="login_member_title">
                                        ${t("login_member_title")}
                                    </h5>
                                    <form id="form-member-login">
                                        <div class="mb-3">
                                            <label class="form-label"
                                                data-i18n="email">
                                                ${t("email")}</label>
                                            <input type="email"
                                                class="form-control"
                                                id="member-email"
                                                required>
                                        </div>
                                        <div class="d-grid">
                                            <button type="submit"
                                                class="btn btn-primary"
                                                data-i18n="login_btn">
                                                ${t("login_btn")}
                                            </button>
                                        </div>
                                        <div class="mt-3 text-center">
                                            <a href="/${this.orgId}/register" data-link data-i18n="register_request">
                                                ${t("register_request")}
                                            </a>
                                        </div>
                                        <div id="member-login-error"
                                            class="text-danger mt-3
                                                text-center d-none">
                                        </div>
                                    </form>
                                </div>

                                <!-- Onglet Admin -->
                                <div class="tab-pane fade"
                                    id="panel-admin" role="tabpanel">
                                    <h5 class="card-title
                                        text-center mb-4"
                                        data-i18n="login_admin_title">
                                        ${t("login_admin_title")}
                                    </h5>
                                    <form id="form-admin-login">
                                        <div class="mb-3">
                                            <label class="form-label"
                                                data-i18n="email">
                                                ${t("email")}</label>
                                            <input type="email"
                                                class="form-control"
                                                id="admin-email"
                                                required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label"
                                                data-i18n="password">
                                                ${t("password")}</label>
                                            <input type="password"
                                                class="form-control"
                                                id="admin-password"
                                                required>
                                        </div>
                                        <div class="d-grid">
                                            <button type="submit"
                                                class="btn btn-primary"
                                                data-i18n="login_btn">
                                                ${t("login_btn")}
                                            </button>
                                        </div>
                                        <div id="admin-login-error"
                                            class="text-danger mt-3
                                                text-center d-none">
                                        </div>
                                    </form>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showError(divId, message) {
        const div = document.getElementById(divId);
        div.textContent = message;
        div.classList.remove('d-none');
    }

    hideError(divId) {
        const div = document.getElementById(divId);
        div.classList.add('d-none');
    }

    async init() {
        // Sans orgId : login superadmin
        if (!this.orgId) {
            this.initSuperadminForm();
            return;
        }
        // Avec orgId : login membre + admin
        this.initMemberForm();
        this.initAdminForm();
    }

    /** Initialise le formulaire superadmin (sans org) */
    initSuperadminForm() {
        document.getElementById('form-admin-login')
            .addEventListener('submit', async (e) => {
                e.preventDefault();
                this.hideError('admin-login-error');
                const password = document.getElementById(
                    'admin-password'
                ).value;
                try {
                    await api.login(password);
                    navigateTo('/');
                } catch (error) {
                    this.showError(
                        'admin-login-error',
                        error.message
                    );
                }
            });
    }

    /** Initialise le formulaire membre (avec org) */
    initMemberForm() {
        document.getElementById('form-member-login')
            .addEventListener('submit', async (e) => {
                e.preventDefault();
                this.hideError('member-login-error');
                const email = document.getElementById(
                    'member-email'
                ).value;
                try {
                    await api.loginMember({
                        orgId: this.orgId, email
                    });
                    navigateTo(`/${this.orgId}`);
                } catch (error) {
                    this.showError(
                        'member-login-error',
                        error.message
                    );
                }
            });
    }

    /** Initialise le formulaire admin (avec org) */
    initAdminForm() {
        document.getElementById('form-admin-login')
            .addEventListener('submit', async (e) => {
                e.preventDefault();
                this.hideError('admin-login-error');
                const email = document.getElementById(
                    'admin-email'
                ).value;
                const password = document.getElementById(
                    'admin-password'
                ).value;
                try {
                    await api.loginAdmin({
                        orgId: this.orgId,
                        email,
                        password
                    });
                    navigateTo(`/${this.orgId}`);
                } catch (error) {
                    this.showError(
                        'admin-login-error',
                        error.message
                    );
                }
            });
    }
}
