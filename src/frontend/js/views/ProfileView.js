class ProfileView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(
            t("my_profile") + " - " + t("brand")
        );
        this.collectiveId = params.collectiveId;
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
            alert('Erreur: ' + error.message);
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
                'Erreur: ' + error.message
            );
        }
    }

    showAlert(type, message) {
        const el = document.getElementById(
            'profile-alert'
        );
        el.className =
            `mt-3 alert alert-${type}`;
        el.textContent = message;
        el.classList.remove('d-none');
        setTimeout(() => {
            el.classList.add('d-none');
        }, 3000);
    }

    async init() {
        await this.loadProfile();

        document.getElementById('profile-form')
            .addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
    }
}
