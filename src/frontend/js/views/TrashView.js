class TrashView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("trash") + " - " + t("brand"));
        this.items = [];
        this.orgId = params.orgId;
    }

    async getHtml() {
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="trash">${t("trash")}</h2>
                <button class="btn btn-danger"
                    id="btn-empty-trash">
                    <i class="bi bi-trash3"></i>
                    <span class="d-none d-md-inline"
                        data-i18n="empty_trash">
                        ${t("empty_trash")}</span>
                </button>
            </div>
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th data-i18n="collection">
                                ${t("collection")}</th>
                            <th data-i18n="summary">
                                ${t("summary")}</th>
                            <th class="d-none d-md-table-cell"
                                data-i18n="deleted_at">
                                ${t("deleted_at")}</th>
                            <th data-i18n="actions">
                                ${t("actions")}</th>
                        </tr>
                    </thead>
                    <tbody id="trash-table-body">
                    </tbody>
                </table>
            </div>
        `;
    }

    _summarize(entry) {
        const item = entry.item;
        const parts = [];
        if (item.lastName) parts.push(item.lastName);
        if (item.firstName) parts.push(item.firstName);
        if (item.email) parts.push(item.email);
        if (item.name) parts.push(item.name);
        if (item.label) parts.push(item.label);
        return parts.length ? parts.join(' — ') : item.id;
    }

    _formatDate(timestamp) {
        return new Date(timestamp).toLocaleString(i18n.lang);
    }

    async loadTrash() {
        try {
            this.items = await api.getTrash(this.orgId);
            this.renderTable();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    renderTable() {
        const tbody =
            document.getElementById('trash-table-body');
        tbody.innerHTML = '';

        if (this.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4"
                        class="text-center text-muted"
                        data-i18n="trash_empty">
                        ${t("trash_empty")}</td>
                </tr>
            `;
            return;
        }

        this.items
            .sort((a, b) => b.deletedAt - a.deletedAt)
            .forEach(entry => {
                const collectionLabel =
                    t(entry.sourceCollection)
                    || entry.sourceCollection;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${collectionLabel}</td>
                    <td>${this._summarize(entry)}</td>
                    <td class="d-none d-md-table-cell">
                        ${this._formatDate(entry.deletedAt)}
                    </td>
                    <td>
                        <div class="btn-group-actions">
                            <button class="btn btn-sm btn-outline-success btn-restore"
                                data-id="${entry.id}"
                                title="${t("restore")}">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-perm-delete"
                                data-id="${entry.id}"
                                title="${t("permanent_delete")}">
                                <i class="bi bi-x-circle"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        document.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                this.restoreItem(id);
            });
        });

        document.querySelectorAll('.btn-perm-delete')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id =
                        e.target.closest('button').dataset.id;
                    this.permanentDeleteItem(id);
                });
            });
    }

    async init() {
        await this.loadTrash();

        document.getElementById('btn-empty-trash')
            .addEventListener('click', () => this.emptyTrash());
    }

    async restoreItem(trashId) {
        try {
            await api.restoreFromTrash(this.orgId, trashId);
            await this.loadTrash();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    async permanentDeleteItem(trashId) {
        if (confirm(t("confirm_permanent_delete"))) {
            try {
                await api.permanentDeleteFromTrash(
                    this.orgId, trashId
                );
                await this.loadTrash();
            } catch (error) {
                alert('Erreur: ' + error.message);
            }
        }
    }

    async emptyTrash() {
        if (confirm(t("confirm_empty_trash"))) {
            try {
                await api.emptyTrash(this.orgId);
                await this.loadTrash();
            } catch (error) {
                alert('Erreur: ' + error.message);
            }
        }
    }
}
