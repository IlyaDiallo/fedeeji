class ProfileView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(
            t("my_profile") + " - " + t("brand")
        );
        this.member = null;
    }

    async getHtml() {
        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="my_profile">
                    ${t("my_profile")}</h2>
            </div>
            <div class="card">
                <div class="card-body">
                    <form id="profile-form">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label"
                                    data-i18n="last_name">
                                    ${t("last_name")}
                                </label>
                                <input type="text"
                                    class="form-control"
                                    id="profile-lastName"
                                    required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label"
                                    data-i18n="first_name">
                                    ${t("first_name")}
                                </label>
                                <input type="text"
                                    class="form-control"
                                    id="profile-firstName"
                                    required>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label"
                                    data-i18n="email">
                                    ${t("email")}</label>
                                <input type="email"
                                    class="form-control"
                                    id="profile-email"
                                    required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label"
                                    data-i18n="phone">
                                    ${t("phone")}</label>
                                <input type="tel"
                                    class="form-control"
                                    id="profile-phone">
                            </div>
                        </div>
                        <hr>
                        <div class="mb-3">
                            <label class="form-label"
                                data-i18n="address">
                                ${t("address")}</label>
                            <input type="text"
                                class="form-control"
                                id="profile-address">
                        </div>
                        <div class="mb-3">
                            <label class="form-label"
                                data-i18n="address2">
                                ${t("address2")}</label>
                            <input type="text"
                                class="form-control"
                                id="profile-address2">
                        </div>
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label class="form-label"
                                    data-i18n="postal_code">
                                    ${t("postal_code")}
                                </label>
                                <input type="text"
                                    class="form-control"
                                    id="profile-postalCode">
                            </div>
                            <div class="col-md-8 mb-3">
                                <label class="form-label"
                                    data-i18n="city">
                                    ${t("city")}</label>
                                <input type="text"
                                    class="form-control"
                                    id="profile-city">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label"
                                data-i18n="country">
                                ${t("country")}</label>
                            <input type="text"
                                class="form-control"
                                id="profile-country">
                        </div>
                        <hr>
                        <div class="d-flex
                            justify-content-end">
                            <button type="submit"
                                class="btn btn-primary"
                                id="btn-save-profile"
                                data-i18n="save">
                                ${t("save")}</button>
                        </div>
                    </form>
                    <div id="profile-alert"
                        class="mt-3 d-none"></div>

                    <!-- Section Home Assistant -->
                    <hr>
                    <h5 class="mt-3 mb-1">
                        <i class="bi bi-phone me-2"></i>
                        ${t("ha_section_title")}
                    </h5>
                    <p class="text-muted small mb-3">
                        ${t("ha_section_desc")}
                    </p>
                    <div class="mb-3">
                        <label class="form-label">
                            ${t("ha_base_url")}
                        </label>
                        <input type="url"
                            class="form-control"
                            id="profile-haBaseUrl"
                            placeholder="https://mon-ha.duckdns.org">
                        <div class="form-text">
                            ${t("ha_base_url_help")}
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">
                            ${t("ha_webhook_id")}
                        </label>
                        <div class="input-group">
                            <input type="text"
                                class="form-control font-monospace"
                                id="profile-haWebhookId"
                                placeholder="-rx2i82Kv0A5Dqv55PiH5Du-Q">
                            <button class="btn btn-outline-secondary"
                                type="button"
                                id="btn-test-ha">
                                <i class="bi bi-send me-1"></i>
                                ${t("ha_test_btn")}
                            </button>
                        </div>
                        <div class="form-text">
                            ${t("ha_webhook_id_help")}
                        </div>
                    </div>
                    <div class="d-flex justify-content-end">
                        <button type="button"
                            class="btn btn-primary"
                            id="btn-save-ha">
                            ${t("save")}
                        </button>
                    </div>
                    <div id="ha-alert" class="mt-3 d-none"></div>
                </div>
            </div>
        `;
    }

    async loadProfile() {
        try {
            this.member = await api.getMyProfile(
                this.collectiveId
            );
            this.fillForm();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    fillForm() {
        if (!this.member) return;
        const m = this.member;
        document.getElementById('profile-lastName')
            .value = m.lastName || '';
        document.getElementById('profile-firstName')
            .value = m.firstName || '';
        document.getElementById('profile-email')
            .value = m.email || '';
        document.getElementById('profile-phone')
            .value = m.phone || '';
        document.getElementById('profile-address')
            .value = m.address || '';
        document.getElementById('profile-address2')
            .value = m.address2 || '';
        document.getElementById('profile-postalCode')
            .value = m.postalCode || '';
        document.getElementById('profile-city')
            .value = m.city || '';
        document.getElementById('profile-country')
            .value = m.country || '';
        document.getElementById('profile-haBaseUrl')
            .value = m.haBaseUrl || '';
        document.getElementById('profile-haWebhookId')
            .value = m.haWebhookId || '';
    }

    async saveProfile() {
        const data = {
            lastName: document.getElementById(
                'profile-lastName'
            ).value,
            firstName: document.getElementById(
                'profile-firstName'
            ).value,
            email: document.getElementById(
                'profile-email'
            ).value,
            phone: document.getElementById(
                'profile-phone'
            ).value,
            address: document.getElementById(
                'profile-address'
            ).value,
            address2: document.getElementById(
                'profile-address2'
            ).value,
            postalCode: document.getElementById(
                'profile-postalCode'
            ).value,
            city: document.getElementById(
                'profile-city'
            ).value,
            country: document.getElementById(
                'profile-country'
            ).value,
        };

        try {
            this.member = await api.updateMyProfile(
                this.collectiveId, data
            );
            this.showAlert('success', t('profile_saved'));
        } catch (error) {
            this.showAlert(
                'danger',
                t("error") + ': ' + error.message
            );
        }
    }

    showAlert(type, message) {
        const el = document.getElementById('profile-alert');
        el.className = `mt-3 alert alert-${type}`;
        el.textContent = message;
        el.classList.remove('d-none');
        setTimeout(() => el.classList.add('d-none'), 3000);
    }

    showHaAlert(type, message) {
        const el = document.getElementById('ha-alert');
        el.className = `mt-3 alert alert-${type}`;
        el.textContent = message;
        el.classList.remove('d-none');
        setTimeout(() => el.classList.add('d-none'), 4000);
    }

    /** Enregistre l'URL de base HA et l'ID de webhook dans le profil. */
    async saveHa() {
        const haBaseUrl = document.getElementById(
            'profile-haBaseUrl'
        ).value.trim().replace(/\/$/, '');
        const haWebhookId = document.getElementById(
            'profile-haWebhookId'
        ).value.trim();

        try {
            this.member = await api.updateMyProfile(
                this.collectiveId, { haBaseUrl, haWebhookId }
            );
            this.showHaAlert('success', t('ha_saved'));
        } catch (error) {
            this.showHaAlert(
                'danger', t('error') + ': ' + error.message
            );
        }
    }

    /** Envoie une notification de test via le webhook HA configuré. */
    async testHa() {
        const btn = document.getElementById('btn-test-ha');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

        try {
            await api.testHaNotification(this.collectiveId);
            this.showHaAlert('success', t('ha_test_ok'));
        } catch (error) {
            this.showHaAlert(
                'danger', t('ha_test_error') + ': ' + error.message
            );
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    async init() {
        await this.loadProfile();

        document.getElementById('profile-form')
            .addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });

        document.getElementById('btn-save-ha')
            .addEventListener('click', () => this.saveHa());

        document.getElementById('btn-test-ha')
            .addEventListener('click', () => this.testHa());
    }
}
