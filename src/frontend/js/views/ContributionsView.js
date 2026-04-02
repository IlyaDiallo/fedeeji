class ContributionsView extends AbstractView {
    constructor(params) {
        super(params);
        this.isMember = api.getRole() === 'member';
        this.setTitle(
            (this.isMember
                ? t("my_contributions")
                : t("contributions"))
            + " - " + t("brand")
        );
        this.contributions = [];
        this.members = [];
        this.collectiveId = params.collectiveId;
    }

    async getHtml() {
        const titleKey = this.isMember
            ? 'my_contributions' : 'contributions';

        // Membre : pas de boutons d'action
        const adminButtons = this.isMember ? '' : `
            <div class="d-flex gap-2">
                <button class="btn btn-outline-primary"
                    id="btn-import-contribution">
                    <i class="bi bi-upload"></i>
                    <span class="d-none d-md-inline"
                        data-i18n="import_xlsx">
                        ${t("import_xlsx")}</span>
                </button>
                <button class="btn btn-primary"
                    id="btn-add-contribution">
                    <i class="bi bi-plus-lg"></i>
                    <span class="d-none d-md-inline"
                        data-i18n="add">
                        ${t("add")}</span>
                </button>
            </div>`;

        const searchBar = this.isMember ? '' : `
            <div class="mb-3">
                <input type="text"
                    id="search-contribution"
                    class="form-control"
                    placeholder="${t("search_member")}">
            </div>`;

        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="${titleKey}">
                    ${t(titleKey)}</h2>
                ${adminButtons}
            </div>
            ${searchBar}
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th data-i18n="member">
                                ${t("member")}</th>
                            <th data-i18n="amount">
                                ${t("amount")}</th>
                            <th data-i18n="currency">
                                ${t("currency")}</th>
                            <th data-i18n="year">
                                ${t("year")}</th>
                            <th class="d-none d-md-table-cell"
                                data-i18n="date">
                                ${t("date")}</th>
                            <th data-i18n="actions">
                                ${t("actions")}</th>
                        </tr>
                    </thead>
                    <tbody id="contributions-table-body">
                    </tbody>
                </table>
            </div>

            <!-- Modal ajout/édition -->
            <div class="modal fade" id="contributionModal"
                tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="contributionModalTitle">
                                ${t("add_edit_contribution")}</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="contribution-form">
                                <input type="hidden"
                                    id="contribution-id">
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="member">
                                        ${t("member")}</label>
                                    <select class="form-select"
                                        id="contribution-memberId"
                                        required>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="amount">
                                        ${t("amount")}</label>
                                    <input type="number" step="0.01"
                                        class="form-control"
                                        id="contribution-amount"
                                        required>
                                </div>
                                <div class="mb-3">
         
                                    <input type="number"
                                        class="form-control"
                                        id="contribution-year"
                                        min="2000" max="2100"
                                        value="${new Date().getFullYear()}"
                                        required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="date">
                                        ${t("date")}</label>
                                    <input type="date"
                                        class="form-control"
                                        id="contribution-date"
                                        required>
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
                                id="btn-save-contribution"
                                data-i18n="save">
                                ${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal import XLSX -->
            <div class="modal fade" id="importModal"
                tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                data-i18n="import_contributions">
                                ${t("import_contributions")}</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="import-form-section">
                                <div class="mb-3">
                                    <label class="form-label"
                                        for="import-file"
                                        data-i18n="import_file_label">
                                        ${t("import_file_label")}</label>
                                    <input type="file"
                                        class="form-control"
                                        id="import-file"
                                        accept=".xlsx">
                                </div>
                            </div>
                            <div id="import-progress-section"
                                class="d-none text-center py-3">
                                <div class="spinner-border text-primary"
                                    role="status"></div>
                                <p class="mt-2"
                                    data-i18n="import_in_progress">
                                    ${t("import_in_progress")}</p>
                            </div>
                            <div id="import-results-section"
                                class="d-none">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal"
                                id="btn-close-import"
                                data-i18n="close">
                                ${t("close")}</button>
                            <button type="button"
                                class="btn btn-primary"
                                id="btn-run-import"
                                data-i18n="import">
                                ${t("import")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            if (this.isMember) {
                // Membre : seulement ses propres contributions
                this.contributions = await api.get(
                    this.collectiveId, 'contributions'
                );
                this.members = [];
            } else {
                [this.contributions, this.members] =
                    await Promise.all([
                        api.get(
                            this.collectiveId, 'contributions'
                        ),
                        api.get(this.collectiveId, 'members')
                    ]);
            }
            this.renderTable();
            if (!this.isMember) {
                this.renderMemberSelect();
            }
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    renderMemberSelect() {
        const select = document.getElementById(
            'contribution-memberId'
        );
        if (!select) return;
        select.innerHTML =
            '<option value="">'
            + 'Sélectionner un membre</option>';
        this.members.forEach(m => {
            select.innerHTML +=
                `<option value="${m.id}">` +
                `${m.lastName} ${m.firstName}`
                + `</option>`;
        });
    }

    renderTable(searchTerm = '') {
        const tbody = document.getElementById(
            'contributions-table-body'
        );
        tbody.innerHTML = '';

        const filtered = this.contributions.filter(s => {
            const member =
                this.members.find(m => m.id === s.memberId);
            const memberName = member
                ? `${member.lastName} ${member.firstName}` : '';
            return memberName.toLowerCase()
                .includes(searchTerm.toLowerCase());
        });

        filtered.forEach(sub => {
            const member = this.members
                .find(m => m.id === sub.memberId);
            const memberName = this.isMember
                ? (api.user?.memberName || '')
                : (member
                    ? `${member.lastName} `
                        + `${member.firstName}`
                    : 'Inconnu');

            const actionsHtml = this.isMember ? '' : `
                <div class="btn-group-actions">
                    <button class="btn btn-sm
                        btn-outline-primary btn-edit"
                        data-id="${sub.id}"
                        title="${t("edit")}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm
                        btn-outline-danger btn-delete"
                        data-id="${sub.id}"
                        title="${t("delete")}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${memberName}</td>
                <td>${sub.amount}</td>
                <td>${sub.currency || 'EUR'}</td>
                <td>${sub.year || ''}</td>
                <td class="d-none d-md-table-cell">
                    ${sub.date}</td>
                <td>${actionsHtml}</td>
            `;
            tbody.appendChild(tr);
        });

        if (!this.isMember) {
            document.querySelectorAll('.btn-edit')
                .forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.target
                            .closest('button').dataset.id;
                        this.openModal(id);
                    });
                });

            document.querySelectorAll('.btn-delete')
                .forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.target
                            .closest('button').dataset.id;
                        this.deleteContribution(id);
                    });
                });
        }
    }

    async init() {
        await this.loadData();

        if (this.isMember) return;

        this.modal = new bootstrap.Modal(
            document.getElementById('contributionModal')
        );
        this.importModal = new bootstrap.Modal(
            document.getElementById('importModal')
        );

        document.getElementById('btn-add-contribution')
            .addEventListener('click', () => {
                this.openModal();
            });

        document.getElementById('btn-save-contribution')
            .addEventListener('click', () => {
                this.saveContribution();
            });

        document.getElementById('search-contribution')
            .addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });

        document.getElementById('btn-import-contribution')
            .addEventListener('click', () => {
                this.openImportModal();
            });

        document.getElementById('btn-run-import')
            .addEventListener('click', () => {
                this.runImport();
            });
    }

    openModal(id = null) {
        const form = document.getElementById('contribution-form');
        form.reset();
        document.getElementById('contribution-id').value = '';

        if (id) {
            const sub = this.contributions
                .find(s => s.id === id);
            if (sub) {
                document.getElementById('contribution-id')
                    .value = sub.id;
                document.getElementById('contribution-memberId')
                    .value = sub.memberId || '';
                document.getElementById('contribution-amount')
                    .value = sub.amount || '';
                document.getElementById('contribution-year')
                    .value = sub.year
                        || new Date().getFullYear();
                document.getElementById('contribution-date')
                    .value = sub.date || '';
            }
        }
        this.modal.show();
    }

    /** Ouvre la modal d'import et réinitialise son état */
    openImportModal() {
        document.getElementById('import-file').value = '';
        document.getElementById('import-form-section')
            .classList.remove('d-none');
        document.getElementById('import-progress-section')
            .classList.add('d-none');
        document.getElementById('import-results-section')
            .classList.add('d-none');
        document.getElementById('btn-run-import')
            .classList.remove('d-none');
        this.importModal.show();
    }

    /** Lance l'import du fichier XLSX sélectionné */
    async runImport() {
        const fileInput =
            document.getElementById('import-file');
        const file = fileInput.files[0];

        if (!file) {
            alert(t("import_file_label"));
            return;
        }

        // Afficher le spinner
        document.getElementById('import-form-section')
            .classList.add('d-none');
        document.getElementById('import-progress-section')
            .classList.remove('d-none');
        document.getElementById('import-results-section')
            .classList.add('d-none');
        document.getElementById('btn-run-import')
            .classList.add('d-none');

        try {
            const results = await api.uploadFile({
                collectiveId: this.collectiveId,
                endpoint: 'import-contributions',
                file
            });
            this.showImportResults(results);
            await this.loadData();
        } catch (error) {
            this.showImportResults({
                total: 0, created: 0, skipped: 0,
                membersCreated: 0,
                errors: [{ row: '-', message: error.message }]
            });
        }
    }

    /** Affiche les résultats de l'import dans la modal */
    showImportResults(results) {
        document.getElementById('import-progress-section')
            .classList.add('d-none');
        const section =
            document.getElementById('import-results-section');
        section.classList.remove('d-none');

        let errorsHtml = '';
        if (results.errors && results.errors.length > 0) {
            const rows = results.errors.map(e =>
                `<tr>
                    <td>${t("import_error_row")} ${e.row}</td>
                    <td>${e.message}</td>
                </tr>`
            ).join('');
            errorsHtml = `
                <div class="mt-3">
                    <h6 class="text-danger">
                        ${t("import_errors")}
                    </h6>
                    <table class="table table-sm table-bordered">
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        }

        section.innerHTML = `
            <h6 data-i18n="import_results">
                ${t("import_results")}</h6>
            <ul class="list-group mb-2">
                <li class="list-group-item
                    d-flex justify-content-between">
                    <span>${t("import_total")}</span>
                    <strong>${results.total}</strong>
                </li>
                <li class="list-group-item
                    d-flex justify-content-between
                    list-group-item-success">
                    <span>${t("import_created")}</span>
                    <strong>${results.created}</strong>
                </li>
                <li class="list-group-item
                    d-flex justify-content-between
                    list-group-item-info">
                    <span>${t("import_members_created")}</span>
                    <strong>${results.membersCreated}</strong>
                </li>
                <li class="list-group-item
                    d-flex justify-content-between
                    list-group-item-warning">
                    <span>${t("import_skipped")}</span>
                    <strong>${results.skipped}</strong>
                </li>
                <li class="list-group-item
                    d-flex justify-content-between
                    ${results.errors?.length
                        ? 'list-group-item-danger' : ''}">
                    <span>${t("import_errors")}</span>
                    <strong>${results.errors?.length || 0}</strong>
                </li>
            </ul>
            ${errorsHtml}
        `;
    }

    async saveContribution() {
        const id =
            document.getElementById('contribution-id').value;
        const data = {
            memberId: document.getElementById(
                'contribution-memberId'
            ).value,
            amount: document.getElementById(
                'contribution-amount'
            ).value,
            year: Number(document.getElementById(
                'contribution-year'
            ).value),
            date: document.getElementById(
                'contribution-date'
            ).value
        };

        if (!data.memberId) {
            alert("Veuillez sélectionner un membre");
            return;
        }

        try {
            if (id) {
                await api.update(
                    this.collectiveId, 'contributions', id, data
                );
            } else {
                await api.create(
                    this.collectiveId, 'contributions', data
                );
            }
            this.modal.hide();
            await this.loadData();
        } catch (error) {
            alert('Erreur lors de la sauvegarde: '
                + error.message);
        }
    }

    async deleteContribution(id) {
        if (confirm(t("confirm_delete"))) {
            try {
                await api.delete(
                    this.collectiveId, 'contributions', id
                );
                await this.loadData();
            } catch (error) {
                alert('Erreur lors de la suppression: '
                    + error.message);
            }
        }
    }
}
