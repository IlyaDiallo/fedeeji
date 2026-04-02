class RegisterView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("register_request") + " - " + t("brand"));
        this.collectiveId = params.collectiveId;
        this.passwordVerified = false;
        this.registrationPassword = "";
    }

    async getHtml() {
        if (!this.passwordVerified) {
            return `
                <div class="row justify-content-center">
                    <div class="col-md-7 col-lg-5">
                        <div class="card mt-5">
                            <div class="card-body">
                                <h5 class="card-title text-center mb-4" data-i18n="register_request">
                                    ${t("register_request")}
                                </h5>
                                <form id="form-verify-password">
                                    <div class="mb-3">
                                        <label class="form-label" data-i18n="registration_password">
                                            ${t("registration_password")}
                                        </label>
                                        <input type="password" class="form-control" id="reg-password" required>
                                    </div>
                                    <div class="d-grid">
                                        <button type="submit" class="btn btn-primary" data-i18n="verify">
                                            ${t("verify")}
                                        </button>
                                    </div>
                                    <div class="mt-3 text-center">
                                        <a href="/${this.collectiveId}/login" data-link data-i18n="back_to_login">
                                            ${t("back_to_login")}
                                        </a>
                                    </div>
                                    <div id="verify-error" class="text-danger mt-3 text-center d-none"></div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="row justify-content-center">
                <div class="col-md-8 col-lg-6">
                    <div class="card mt-4 mb-4">
                        <div class="card-body">
                            <h5 class="card-title text-center mb-4" data-i18n="register_request">
                                ${t("register_request")}
                            </h5>
                            <form id="form-register">
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="last_name">${t("last_name")}</label>
                                    <input type="text" class="form-control" id="member-lastName" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="first_name">${t("first_name")}</label>
                                    <input type="text" class="form-control" id="member-firstName" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="email">${t("email")}</label>
                                    <input type="email" class="form-control" id="member-email" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="phone">${t("phone")}</label>
                                    <input type="tel" class="form-control" id="member-phone">
                                </div>
                                <hr>
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="address">${t("address")}</label>
                                    <input type="text" class="form-control" id="member-address">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="address2">${t("address2")}</label>
                                    <input type="text" class="form-control" id="member-address2">
                                </div>
                                <div class="row">
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label" data-i18n="postal_code">${t("postal_code")}</label>
                                        <input type="text" class="form-control" id="member-postalCode">
                                    </div>
                                    <div class="col-md-8 mb-3">
                                        <label class="form-label" data-i18n="city">${t("city")}</label>
                                        <input type="text" class="form-control" id="member-city">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="country">${t("country")}</label>
                                    <input type="text" class="form-control" id="member-country">
                                </div>
                                <div class="d-grid gap-2">
                                    <button type="submit" class="btn btn-primary" data-i18n="save">${t("save")}</button>
                                    <a href="/${this.collectiveId}/login" class="btn btn-secondary" data-link data-i18n="cancel">${t("cancel")}</a>
                                </div>
                                <div id="register-error" class="text-danger mt-3 text-center d-none"></div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _updateTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (el.tagName === 'INPUT' && el.type === 'text' && el.placeholder) {
                el.placeholder = t(key);
            } else {
                el.innerText = t(key);
            }
        });
    }

    async init() {
        if (!this.passwordVerified) {
            const form = document.getElementById('form-verify-password');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const errDiv = document.getElementById('verify-error');
                    errDiv.classList.add('d-none');
                    const pwd = document.getElementById('reg-password').value;
                    try {
                        await api.verifyRegistrationPassword(this.collectiveId, pwd);
                        this.registrationPassword = pwd;
                        this.passwordVerified = true;
                        document.querySelector("#app").innerHTML = await this.getHtml();
                        this._updateTranslations();
                        await this.init(); // re-bind events for the second form
                    } catch (error) {
                        errDiv.textContent = error.message;
                        errDiv.classList.remove('d-none');
                    }
                });
            }
        } else {
            const form = document.getElementById('form-register');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const errDiv = document.getElementById('register-error');
                    errDiv.classList.add('d-none');
                    
                    const memberData = {
                        lastName: document.getElementById('member-lastName').value,
                        firstName: document.getElementById('member-firstName').value,
                        email: document.getElementById('member-email').value,
                        phone: document.getElementById('member-phone').value,
                        address: document.getElementById('member-address').value,
                        address2: document.getElementById('member-address2').value,
                        postalCode: document.getElementById('member-postalCode').value,
                        city: document.getElementById('member-city').value,
                        country: document.getElementById('member-country').value
                    };
                    
                    try {
                        await api.registerMember({
                            collectiveId: this.collectiveId,
                            password: this.registrationPassword,
                            memberData
                        });
                        alert(t("registration_success"));
                        navigateTo(`/${this.collectiveId}/login`);
                    } catch (error) {
                        errDiv.textContent = error.message;
                        errDiv.classList.remove('d-none');
                    }
                });
            }
        }
    }
}
