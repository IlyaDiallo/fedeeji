class MembersView extends AbstractView {
    constructor(params) {
        super(params);
        this.role = api.getRole();
        this.isMember = this.role === 'member';
        this.setTitle(
            t(this.isMember ? "my_profile" : "members")
            + " - " + t("brand")
        );
        this.members = [];
        this.member = null;
    }

    async getHtml() {
        return this.isMember
            ? this._getProfileHtml()
            : this._getMembersHtml();
    }

    // ─── Vue profil (membre) ────────────────────────────────────────────

    _getProfileHtml() {
        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="my_profile">
                    ${t("my_profile")}</h2>
            </div>
            <div class="card">
                <div class="card-body">
                    ${this._getPersonalFieldsHtml('profile')}
                    <div class="d-flex justify-content-end">
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
                    ${this._getHaFieldsHtml('profile')}
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

    // ─── Vue liste membres (admin/superadmin) ───────────────────────────

    _getMembersHtml() {
        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="members">
                    ${t("members")}</h2>
                <button class="btn btn-primary"
                    id="btn-add-member">
                    <i class="bi bi-plus-lg"></i>
                    <span class="d-none d-md-inline"
                        data-i18n="add_member">
                        ${t("add_member")}</span>
                </button>
            </div>
            <div class="mb-3">
                <input type="text" id="search-member"
                    class="form-control"
                    placeholder="${t("search_member")}">
            </div>
            <div class="table-responsive">
                <table class="table table-striped
                    table-hover">
                    <thead>
                        <tr>
                            <th data-i18n="last_name">
                                ${t("last_name")}</th>
                            <th data-i18n="first_name">
                                ${t("first_name")}</th>
                            <th class="d-none d-md-table-cell"
                                data-i18n="email">
                                ${t("email")}</th>
                            <th class="d-none d-md-table-cell">
                                Admin</th>
                            <th data-i18n="actions">
                                ${t("actions")}</th>
                        </tr>
                    </thead>
                    <tbody id="members-table-body">
                    </tbody>
                </table>
            </div>

            ${this._getNotificationSettingsHtml()}

            <!-- Modal -->
            <div class="modal fade" id="memberModal"
                tabindex="-1">
                <div class="modal-dialog
                    modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="memberModalTitle"
                                data-i18n="add_edit_member">
                                ${t("add_edit_member")}</h5>
                            <button type="button"
                                class="btn-close"
                                data-bs-dismiss="modal">
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="member-form">
                                <input type="hidden"
                                    id="member-id">
                                ${this._getPersonalFieldsHtml('member')}
                                <div class="mb-3
                                    form-check form-switch">
                                    <input type="checkbox"
                                        class="form-check-input"
                                        id="member-admin">
                                    <label
                                        class="form-check-label"
                                        for="member-admin"
                                        data-i18n="is_admin">
                                        ${t("is_admin")}
                                    </label>
                                </div>
                                <div class="mb-3 d-none"
                                    id="admin-password-group">
                                    <label class="form-label"
                                        data-i18n="admin_password">
                                        ${t("admin_password")}
                                    </label>
                                    <input type="password"
                                        class="form-control"
                                        id="member-adminPassword">
                                    <div class="form-text"
                                        data-i18n="admin_password_hint">
                                        ${t("admin_password_hint")}
                                    </div>
                                </div>
                                <hr>
                                <h6 class="mb-2">
                                    <i class="bi bi-phone me-1"></i>
                                    ${t("ha_section_title")}
                                </h6>
                                ${this._getHaFieldsHtml('member')}
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal"
                                data-i18n="cancel">
                                ${t("cancel")}</button>
                            <button type="button"
                                class="btn btn-primary"
                                id="btn-save-member"
                                data-i18n="save">
                                ${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Génère les champs personnels communs (nom, prénom, email, téléphone, adresse…).
     * Le préfixe permet de distinguer les IDs selon le contexte (profile ou member).
     */
    _getPersonalFieldsHtml(prefix) {
        const isProfile = prefix === 'profile';
        const wrap = isProfile
            ? `<form id="profile-form">`
            : '';
        return `
            ${wrap}
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label"
                        data-i18n="last_name">
                        ${t("last_name")}
                    </label>
                    <input type="text"
                        class="form-control"
                        id="${prefix}-lastName"
                        required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label"
                        data-i18n="first_name">
                        ${t("first_name")}
                    </label>
                    <input type="text"
                        class="form-control"
                        id="${prefix}-firstName"
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
                        id="${prefix}-email"
                        required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label"
                        data-i18n="phone">
                        ${t("phone")}</label>
                    <input type="tel"
                        class="form-control"
                        id="${prefix}-phone">
                </div>
            </div>
            <hr>
            <div class="mb-3">
                <label class="form-label"
                    data-i18n="address">
                    ${t("address")}
                </label>
                <input type="text"
                    class="form-control"
                    id="${prefix}-address">
            </div>
            <div class="mb-3">
                <label class="form-label"
                    data-i18n="address2">
                    ${t("address2")}
                </label>
                <input type="text"
                    class="form-control"
                    id="${prefix}-address2">
            </div>
            <div class="row">
                <div class="col-md-4 mb-3">
                    <label class="form-label"
                        data-i18n="postal_code">
                        ${t("postal_code")}
                    </label>
                    <input type="text"
                        class="form-control"
                        id="${prefix}-postalCode">
                </div>
                <div class="col-md-8 mb-3">
                    <label class="form-label"
                        data-i18n="city">
                        ${t("city")}
                    </label>
                    <input type="text"
                        class="form-control"
                        id="${prefix}-city">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label"
                    data-i18n="country">
                    ${t("country")}
                </label>
                <input type="text"
                    class="form-control"
                    id="${prefix}-country">
            </div>
            <hr>
        `;
    }

    /**
     * Génère les champs HA (URL de base et webhook ID).
     * En mode profil, le webhook inclut le bouton de test et les textes d'aide.
     */
    _getHaFieldsHtml(prefix) {
        const isProfile = prefix === 'profile';
        const webhookInput = isProfile
            ? `
                <div class="input-group">
                    <input type="text"
                        class="form-control font-monospace"
                        id="${prefix}-haWebhookId"
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
                </div>`
            : `
                <input type="text"
                    class="form-control font-monospace"
                    id="${prefix}-haWebhookId"
                    placeholder="-rx2i82Kv0A5Dqv55PiH5Du-Q">`;
        return `
            <div class="mb-3">
                <label class="form-label">
                    ${t("ha_base_url")}
                </label>
                <input type="url"
                    class="form-control"
                    id="${prefix}-haBaseUrl"
                    placeholder="https://mon-ha.duckdns.org">
                ${isProfile
                    ? `<div class="form-text">${t("ha_base_url_help")}</div>`
                    : ''}
            </div>
            <div class="mb-3">
                <label class="form-label">
                    ${t("ha_webhook_id")}
                </label>
                ${webhookInput}
            </div>
        `;
    }

    // ─── Initialisation ─────────────────────────────────────────────────

    async init() {
        if (this.isMember) {
            await this._initProfile();
        } else {
            await this._initMembers();
        }
    }

    // ─── Logique profil membre ──────────────────────────────────────────

    async _initProfile() {
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

    async loadProfile() {
        try {
            this.member = await api.getMyProfile(
                this.collectiveId
            );
            this._fillProfileForm();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    _fillProfileForm() {
        if (!this.member) return;
        const m = this.member;
        const fields = [
            'lastName', 'firstName', 'email', 'phone',
            'address', 'address2', 'postalCode', 'city',
            'country', 'haBaseUrl', 'haWebhookId'
        ];
        fields.forEach(f => {
            const el = document.getElementById(`profile-${f}`);
            if (el) el.value = m[f] || '';
        });
    }

    /** Collecte les champs personnels du formulaire profil. */
    _readProfileFields() {
        const fields = [
            'lastName', 'firstName', 'email', 'phone',
            'address', 'address2', 'postalCode', 'city', 'country'
        ];
        return Object.fromEntries(
            fields.map(f => [
                f,
                document.getElementById(`profile-${f}`).value
            ])
        );
    }

    async saveProfile() {
        try {
            this.member = await api.updateMyProfile(
                this.collectiveId, this._readProfileFields()
            );
            this._showAlert({ elId: 'profile-alert', type: 'success', msg: t('profile_saved') });
        } catch (error) {
            this._showAlert({
                elId: 'profile-alert',
                type: 'danger',
                msg: t("error") + ': ' + error.message
            });
        }
    }

    /** Enregistre l'URL HA et le webhook ID dans le profil. */
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
            this._showAlert({ elId: 'ha-alert', type: 'success', msg: t('ha_saved') });
        } catch (error) {
            this._showAlert({
                elId: 'ha-alert',
                type: 'danger',
                msg: t('error') + ': ' + error.message
            });
        }
    }

    /** Envoie une notification de test via le webhook HA configuré. */
    async testHa() {
        const btn = document.getElementById('btn-test-ha');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML =
            `<span class="spinner-border spinner-border-sm"></span>`;

        try {
            await api.testHaNotification(this.collectiveId);
            this._showAlert({ elId: 'ha-alert', type: 'success', msg: t('ha_test_ok'), delay: 4000 });
        } catch (error) {
            this._showAlert({
                elId: 'ha-alert',
                type: 'danger',
                msg: t('ha_test_error') + ': ' + error.message,
                delay: 4000
            });
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    /** Affiche un message d'alerte temporaire dans l'élément cible. */
    _showAlert({ elId, type, msg, delay = 3000 }) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.className = `mt-3 alert alert-${type}`;
        el.textContent = msg;
        el.classList.remove('d-none');
        setTimeout(() => el.classList.add('d-none'), delay);
    }

    _getNotificationSettingsHtml() {
        return `<details class="card p-3 my-3"><summary>${t('ha_common_settings')}</summary>
            <form id="ha-settings-form" class="mt-3">
                <p class="small">${t('ha_settings_help')}</p>
                <label class="form-label" for="ha-timezone">${t('ha_timezone')}</label>
                <input id="ha-timezone" class="form-control mb-2" placeholder="Europe/Paris" required>
                <div class="row"><div class="col">
                    <label class="form-label" for="ha-quiet-start">${t('ha_quiet_start')}</label>
                    <input id="ha-quiet-start" type="time" class="form-control mb-2" required>
                </div><div class="col">
                    <label class="form-label" for="ha-quiet-end">${t('ha_quiet_end')}</label>
                    <input id="ha-quiet-end" type="time" class="form-control mb-2" required>
                </div></div>
                <label class="form-label" for="ha-origins">${t('ha_origins')}</label>
                <textarea id="ha-origins" class="form-control mb-2" placeholder="https://ha.example.org" required></textarea>
                <label class="form-label" for="ha-tls-exceptions">${t('ha_tls_exceptions')}</label>
                <textarea id="ha-tls-exceptions" class="form-control mb-2"></textarea>
                <button class="btn btn-primary" type="submit">${t('save')}</button>
            </form>
            <hr><label for="ha-test-member" class="form-label">${t('ha_test_recipient')}</label>
            <select id="ha-test-member" class="form-select mb-2"></select>
            <div class="d-flex flex-wrap gap-2">
                <button type="button" id="ha-admin-test" class="btn btn-outline-primary">${t('ha_test_btn')}</button>
                <button type="button" id="ha-refresh-diagnostics" class="btn btn-outline-secondary">${t('ha_diagnostics')}</button>
            </div>
            <p id="ha-settings-result" class="mt-2" role="status"></p>
            <pre id="ha-diagnostics" class="small text-wrap"></pre>
        </details>`;
    }

    async _initNotificationSettings() {
        const result = document.getElementById('ha-settings-result');
        const showError = error => { result.textContent = `${t('error')}: ${error.message}`; };
        const memberSelect = document.getElementById('ha-test-member');
        memberSelect.replaceChildren(new Option('—', ''));
        this.members.forEach(member => memberSelect.add(new Option(
            `${member.firstName || ''} ${member.lastName || ''}`.trim(), member.id
        )));
        try {
            const settings = await api.getNotificationSettings(this.collectiveId);
            document.getElementById('ha-timezone').value = settings?.timeZone || '';
            document.getElementById('ha-quiet-start').value = settings?.quietStart || '';
            document.getElementById('ha-quiet-end').value = settings?.quietEnd || '';
            document.getElementById('ha-origins').value = (settings?.allowedOrigins || []).join('\n');
            document.getElementById('ha-tls-exceptions').value = (settings?.insecureTlsOrigins || []).join('\n');
        } catch (error) { showError(error); }
        document.getElementById('ha-settings-form').addEventListener('submit', async event => {
            event.preventDefault();
            const lines = id => document.getElementById(id).value.split('\n').map(line => line.trim()).filter(Boolean);
            try {
                await api.saveNotificationSettings(this.collectiveId, {
                    timeZone: document.getElementById('ha-timezone').value.trim(),
                    quietStart: document.getElementById('ha-quiet-start').value,
                    quietEnd: document.getElementById('ha-quiet-end').value,
                    allowedOrigins: lines('ha-origins'), insecureTlsOrigins: lines('ha-tls-exceptions')
                });
                result.textContent = t('ha_saved');
            } catch (error) { showError(error); }
        });
        document.getElementById('ha-admin-test').addEventListener('click', async () => {
            if (!memberSelect.value) { result.textContent = t('please_select_member'); return; }
            try {
                await api.testHaNotification(this.collectiveId, memberSelect.value);
                result.textContent = t('ha_test_ok');
            } catch (error) { showError(error); }
        });
        document.getElementById('ha-refresh-diagnostics').addEventListener('click', async () => {
            try {
                const diagnostics = await api.getNotificationDiagnostics(this.collectiveId);
                document.getElementById('ha-diagnostics').textContent = JSON.stringify(diagnostics, null, 2);
                result.textContent = t('ha_diagnostics_help');
            } catch (error) { showError(error); }
        });
    }

    // ─── Logique liste membres (admin) ──────────────────────────────────

    async _initMembers() {
        await this.loadMembers();
        await this._initNotificationSettings();

        this.modal = new bootstrap.Modal(
            document.getElementById('memberModal')
        );

        document.getElementById('btn-add-member')
            .addEventListener('click', () => this.openModal());

        document.getElementById('btn-save-member')
            .addEventListener('click', () => this.saveMember());

        document.getElementById('search-member')
            .addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });

        // Toggle affichage mot de passe admin
        document.getElementById('member-admin')
            .addEventListener('change', () => {
                this._toggleAdminPassword();
            });
    }

    async loadMembers() {
        try {
            this.members = await api.get(
                this.collectiveId, 'members'
            );
            this.renderTable();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    renderTable(searchTerm = '') {
        const tbody = document.getElementById(
            'members-table-body'
        );
        tbody.innerHTML = '';

        const filtered = this.members.filter(m =>
            m.firstName?.toLowerCase()
                .includes(searchTerm.toLowerCase())
            || m.lastName?.toLowerCase()
                .includes(searchTerm.toLowerCase())
            || m.email?.toLowerCase()
                .includes(searchTerm.toLowerCase())
        );

        filtered.forEach(member => {
            const tr = document.createElement('tr');
            const adminBadge = member.admin
                ? `<span class="badge bg-warning
                    text-dark">Admin</span>`
                : '';
            tr.innerHTML = `
                <td>${member.lastName}</td>
                <td>${member.firstName}</td>
                <td class="d-none d-md-table-cell">
                    ${member.email}</td>
                <td class="d-none d-md-table-cell">
                    ${adminBadge}</td>
                <td>
                    <div class="btn-group-actions">
                        <button class="btn btn-sm
                            btn-outline-primary btn-edit"
                            data-id="${member.id}"
                            title="${t("edit")}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm
                            btn-outline-danger btn-delete"
                            data-id="${member.id}"
                            title="${t("delete")}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id =
                        e.target.closest('button').dataset.id;
                    this.openModal(id);
                });
            });

        document.querySelectorAll('.btn-delete')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id =
                        e.target.closest('button').dataset.id;
                    this.deleteMember(id);
                });
            });
    }

    /** Affiche/masque le champ mot de passe admin. */
    _toggleAdminPassword() {
        const isAdmin = document.getElementById(
            'member-admin'
        ).checked;
        const group = document.getElementById(
            'admin-password-group'
        );
        group.classList.toggle('d-none', !isAdmin);
    }

    openModal(id = null) {
        const form = document.getElementById('member-form');
        form.reset();
        document.getElementById('member-id').value = '';
        document.getElementById('member-admin').checked = false;
        this._toggleAdminPassword();

        if (id) {
            const member = this.members.find(m => m.id === id);
            if (member) {
                const fields = [
                    'id', 'lastName', 'firstName', 'email',
                    'phone', 'address', 'address2',
                    'postalCode', 'city', 'country',
                    'haBaseUrl', 'haWebhookId'
                ];
                fields.forEach(f => {
                    const el = document.getElementById(`member-${f}`);
                    if (el) el.value = member[f] || '';
                });
                document.getElementById('member-admin')
                    .checked = !!member.admin;
                this._toggleAdminPassword();
            }
        }
        this.modal.show();
    }

    async saveMember() {
        const id = document.getElementById('member-id').value;
        const isAdmin = document.getElementById('member-admin').checked;
        const adminPassword = document.getElementById(
            'member-adminPassword'
        ).value;

        const fields = [
            'lastName', 'firstName', 'email', 'phone',
            'address', 'address2', 'postalCode', 'city', 'country',
            'haBaseUrl', 'haWebhookId'
        ];
        const data = Object.fromEntries(
            fields.map(f => [
                f,
                document.getElementById(`member-${f}`).value
            ])
        );
        data.admin = isAdmin;

        // Envoyer le mot de passe seulement s'il est rempli
        if (isAdmin && adminPassword) {
            data.adminPassword = adminPassword;
        }

        try {
            if (id) {
                await api.update(
                    this.collectiveId, 'members', id, data
                );
            } else {
                await api.create(
                    this.collectiveId, 'members', data
                );
            }
            this.modal.hide();
            await this.loadMembers();
        } catch (error) {
            alert(t("error_save") + ': ' + error.message);
        }
    }

    async deleteMember(id) {
        if (confirm(t("confirm_delete"))) {
            try {
                await api.delete(
                    this.collectiveId, 'members', id
                );
                await this.loadMembers();
            } catch (error) {
                alert(t("error_delete") + ': '
                    + error.message);
            }
        }
    }
}
