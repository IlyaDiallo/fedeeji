class MembersView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("members") + " - " + t("brand"));
        this.members = [];
    }

    async getHtml() {
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
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="last_name">
                                        ${t("last_name")}
                                    </label>
                                    <input type="text"
                                        class="form-control"
                                        id="member-lastName"
                                        required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="first_name">
                                        ${t("first_name")}
                                    </label>
                                    <input type="text"
                                        class="form-control"
                                        id="member-firstName"
                                        required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="email">
                                        ${t("email")}</label>
                                    <input type="email"
                                        class="form-control"
                                        id="member-email"
                                        required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="phone">
                                        ${t("phone")}</label>
                                    <input type="tel"
                                        class="form-control"
                                        id="member-phone">
                                </div>
                                <hr>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="address">
                                        ${t("address")}
                                    </label>
                                    <input type="text"
                                        class="form-control"
                                        id="member-address">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="address2">
                                        ${t("address2")}
                                    </label>
                                    <input type="text"
                                        class="form-control"
                                        id="member-address2">
                                </div>
                                <div class="row">
                                    <div class="col-md-4 mb-3">
                                        <label
                                            class="form-label"
                                            data-i18n="postal_code">
                                            ${t("postal_code")}
                                        </label>
                                        <input type="text"
                                            class="form-control"
                                            id="member-postalCode">
                                    </div>
                                    <div class="col-md-8 mb-3">
                                        <label
                                            class="form-label"
                                            data-i18n="city">
                                            ${t("city")}
                                        </label>
                                        <input type="text"
                                            class="form-control"
                                            id="member-city">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="country">
                                        ${t("country")}
                                    </label>
                                    <input type="text"
                                        class="form-control"
                                        id="member-country">
                                </div>
                                <hr>
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
                        e.target.closest('button')
                            .dataset.id;
                    this.openModal(id);
                });
            });

        document.querySelectorAll('.btn-delete')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id =
                        e.target.closest('button')
                            .dataset.id;
                    this.deleteMember(id);
                });
            });
    }

    /** Affiche/masque le champ mot de passe admin */
    toggleAdminPassword() {
        const isAdmin = document.getElementById(
            'member-admin'
        ).checked;
        const group = document.getElementById(
            'admin-password-group'
        );
        if (isAdmin) {
            group.classList.remove('d-none');
        } else {
            group.classList.add('d-none');
        }
    }

    async init() {
        await this.loadMembers();

        this.modal = new bootstrap.Modal(
            document.getElementById('memberModal')
        );

        document.getElementById('btn-add-member')
            .addEventListener('click', () => {
                this.openModal();
            });

        document.getElementById('btn-save-member')
            .addEventListener('click', () => {
                this.saveMember();
            });

        document.getElementById('search-member')
            .addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });

        // Toggle affichage mot de passe admin
        document.getElementById('member-admin')
            .addEventListener('change', () => {
                this.toggleAdminPassword();
            });
    }

    openModal(id = null) {
        const form = document.getElementById(
            'member-form'
        );
        form.reset();
        document.getElementById('member-id').value = '';
        document.getElementById('member-admin')
            .checked = false;
        this.toggleAdminPassword();

        if (id) {
            const member = this.members
                .find(m => m.id === id);
            if (member) {
                document.getElementById('member-id')
                    .value = member.id;
                document.getElementById('member-lastName')
                    .value = member.lastName;
                document.getElementById('member-firstName')
                    .value = member.firstName;
                document.getElementById('member-email')
                    .value = member.email;
                document.getElementById('member-phone')
                    .value = member.phone || '';
                document.getElementById('member-address')
                    .value = member.address || '';
                document.getElementById('member-address2')
                    .value = member.address2 || '';
                document.getElementById(
                    'member-postalCode'
                ).value = member.postalCode || '';
                document.getElementById('member-city')
                    .value = member.city || '';
                document.getElementById('member-country')
                    .value = member.country || '';
                document.getElementById('member-admin')
                    .checked = !!member.admin;
                this.toggleAdminPassword();
            }
        }
        this.modal.show();
    }

    async saveMember() {
        const id = document.getElementById(
            'member-id'
        ).value;
        const isAdmin = document.getElementById(
            'member-admin'
        ).checked;
        const adminPassword = document.getElementById(
            'member-adminPassword'
        ).value;

        const data = {
            lastName: document.getElementById(
                'member-lastName'
            ).value,
            firstName: document.getElementById(
                'member-firstName'
            ).value,
            email: document.getElementById(
                'member-email'
            ).value,
            phone: document.getElementById(
                'member-phone'
            ).value,
            address: document.getElementById(
                'member-address'
            ).value,
            address2: document.getElementById(
                'member-address2'
            ).value,
            postalCode: document.getElementById(
                'member-postalCode'
            ).value,
            city: document.getElementById(
                'member-city'
            ).value,
            country: document.getElementById(
                'member-country'
            ).value,
            admin: isAdmin
        };

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
            alert(t("error_save") + ': '
                + error.message);
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
