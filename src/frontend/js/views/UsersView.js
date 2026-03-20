class UsersView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("users") + " - " + t("brand"));
        this.users = [];
        this.orgId = params.orgId;
    }

    async getHtml() {
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="users">${t("users")}</h2>
                <button class="btn btn-primary" id="btn-add-user">
                    <i class="bi bi-plus-lg"></i>
                    <span class="d-none d-md-inline"
                        data-i18n="add_member">
                        ${t("add_member")}</span>
                </button>
            </div>
            <div class="mb-3">
                <input type="text" id="search-user"
                    class="form-control"
                    placeholder="${t("search_member")}">
            </div>
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th data-i18n="last_name">
                                ${t("last_name")}</th>
                            <th data-i18n="first_name">
                                ${t("first_name")}</th>
                            <th class="d-none d-md-table-cell"
                                data-i18n="email">
                                ${t("email")}</th>
                            <th data-i18n="role">
                                ${t("role")}</th>
                            <th data-i18n="actions">
                                ${t("actions")}</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body">
                    </tbody>
                </table>
            </div>

            <!-- Modal -->
            <div class="modal fade" id="userModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="userModalTitle">
                                ${t("add_edit_member")}</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="user-form">
                                <input type="hidden" id="user-id">
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="last_name">
                                        ${t("last_name")}</label>
                                    <input type="text"
                                        class="form-control"
                                        id="user-lastName" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="first_name">
                                        ${t("first_name")}</label>
                                    <input type="text"
                                        class="form-control"
                                        id="user-firstName" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="email">
                                        ${t("email")}</label>
                                    <input type="email"
                                        class="form-control"
                                        id="user-email" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="role">
                                        ${t("role")}</label>
                                    <select class="form-select"
                                        id="user-role" required>
                                        <option value="admin">
                                            Admin</option>
                                        <option value="user">
                                            User</option>
                                    </select>
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
                                id="btn-save-user"
                                data-i18n="save">
                                ${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadUsers() {
        try {
            this.users = await api.get(this.orgId, 'users');
            this.renderTable();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    renderTable(searchTerm = '') {
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';

        const filtered = this.users.filter(u =>
            u.firstName?.toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
            u.lastName?.toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase()
                .includes(searchTerm.toLowerCase())
        );

        filtered.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.lastName || ''}</td>
                <td>${user.firstName || ''}</td>
                <td class="d-none d-md-table-cell">
                    ${user.email || ''}</td>
                <td>${user.role || ''}</td>
                <td>
                    <div class="btn-group-actions">
                        <button class="btn btn-sm btn-outline-primary btn-edit"
                            data-id="${user.id}"
                            title="${t("edit")}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete"
                            data-id="${user.id}"
                            title="${t("delete")}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                this.openModal(id);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                this.deleteUser(id);
            });
        });
    }

    async init() {
        await this.loadUsers();

        this.modal = new bootstrap.Modal(
            document.getElementById('userModal')
        );

        document.getElementById('btn-add-user')
            .addEventListener('click', () => {
                this.openModal();
            });

        document.getElementById('btn-save-user')
            .addEventListener('click', () => {
                this.saveUser();
            });

        document.getElementById('search-user')
            .addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });
    }

    openModal(id = null) {
        const form = document.getElementById('user-form');
        form.reset();
        document.getElementById('user-id').value = '';

        if (id) {
            const user = this.users.find(u => u.id === id);
            if (user) {
                document.getElementById('user-id').value =
                    user.id;
                document.getElementById('user-lastName').value =
                    user.lastName || '';
                document.getElementById('user-firstName').value =
                    user.firstName || '';
                document.getElementById('user-email').value =
                    user.email || '';
                document.getElementById('user-role').value =
                    user.role || 'user';
            }
        }
        this.modal.show();
    }

    async saveUser() {
        const id = document.getElementById('user-id').value;
        const data = {
            lastName:
                document.getElementById('user-lastName').value,
            firstName:
                document.getElementById('user-firstName').value,
            email:
                document.getElementById('user-email').value,
            role:
                document.getElementById('user-role').value
        };

        try {
            if (id) {
                await api.update(
                    this.orgId, 'users', id, data
                );
            } else {
                await api.create(this.orgId, 'users', data);
            }
            this.modal.hide();
            await this.loadUsers();
        } catch (error) {
            alert('Erreur lors de la sauvegarde: '
                + error.message);
        }
    }

    async deleteUser(id) {
        if (confirm(t("confirm_delete"))) {
            try {
                await api.delete(this.orgId, 'users', id);
                await this.loadUsers();
            } catch (error) {
                alert('Erreur lors de la suppression: '
                    + error.message);
            }
        }
    }
}
