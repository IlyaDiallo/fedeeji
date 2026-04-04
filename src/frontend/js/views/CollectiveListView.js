class CollectiveListView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("collective_list_title"));
    }

    async getHtml() {
        return `
            <div class="alert alert-info d-flex align-items-center mb-3"
                id="superadmin-email-banner" style="display: none !important;">
                <i class="bi bi-envelope me-2"></i>
                <span>
                    Contact superadmin :
                    <a id="superadmin-email-link" href="#"></a>
                </span>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="collective_list_title">${t("collective_list_title")}</h2>
                <button class="btn btn-success" id="new-org-btn">
                    <i class="bi bi-plus-lg"></i> Nouveau collectif
                </button>
            </div>
            <div class="row" id="orgs-container">
                <!-- Rempli dynamiquement -->
            </div>

            <!-- Modal de création collectif -->
            <div class="modal fade" id="newOrgModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Nouveau collectif</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="new-org-form">
                                <div class="mb-3">
                                    <label class="form-label">ID (slug) *</label>
                                    <input type="text" class="form-control"
                                        id="new-org-id"
                                        pattern="[a-z0-9-]+"
                                        placeholder="ex: mon-association" required>
                                    <small class="text-muted">
                                        Lettres minuscules, chiffres et tirets uniquement
                                    </small>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Nom complet *</label>
                                    <input type="text" class="form-control"
                                        id="new-org-name" required
                                        placeholder="ex: Association Sportive">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Label *</label>
                                    <input type="text" class="form-control"
                                        id="new-org-label" required
                                        placeholder="ex: ASA">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Email admin</label>
                                    <input type="email" class="form-control"
                                        id="new-org-adminEmail"
                                        placeholder="admin@exemple.com">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Langue par défaut</label>
                                    <select class="form-select"
                                        id="new-org-defaultLanguage">
                                        <option value="fr">Français</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">
                                        Mot de passe inscription
                                    </label>
                                    <input type="text" class="form-control"
                                        id="new-org-registrationPassword"
                                        placeholder="Laissé vide = inscriptions closes">
                                </div>

                                <div class="mb-3">
                                    <div class="form-check">
                                        <input type="checkbox"
                                            class="form-check-input"
                                            id="new-org-contributionsEnabled"
                                            checked>
                                        <label class="form-check-label">
                                            Activer les contributions
                                        </label>
                                    </div>
                                </div>

                                <div class="text-end">
                                    <button type="button" class="btn btn-secondary"
                                        data-bs-dismiss="modal">Annuler</button>
                                    <button type="submit"
                                        class="btn btn-primary">
                                        Créer
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal d'édition collectif -->
            <div class="modal fade" id="editOrgModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Modifier le collectif</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-org-form">
                                <input type="hidden" id="edit-org-id">

                                <div class="mb-3 text-center">
                                    <img id="edit-org-logo-preview"
                                        src="/favicon.svg" alt="Logo"
                                        class="mb-2"
                                        style="max-height: 80px;">
                                    <div>
                                        <label class="form-label">
                                            Logo (max 1 Mo)
                                        </label>
                                        <input type="file" class="form-control"
                                            id="edit-org-logo" accept="image/*">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Nom</label>
                                    <input type="text" class="form-control"
                                        id="edit-org-name" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Label</label>
                                    <input type="text" class="form-control"
                                        id="edit-org-label" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Email admin</label>
                                    <input type="email" class="form-control"
                                        id="edit-org-adminEmail">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">
                                        Langue par défaut
                                    </label>
                                    <select class="form-select"
                                        id="edit-org-defaultLanguage">
                                        <option value="fr">Français</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">
                                        Mot de passe inscription
                                    </label>
                                    <input type="text" class="form-control"
                                        id="edit-org-registrationPassword">
                                </div>

                                <div class="mb-3">
                                    <div class="form-check">
                                        <input type="checkbox"
                                            class="form-check-input"
                                            id="edit-org-contributionsEnabled">
                                        <label class="form-check-label">
                                            Activer les contributions
                                        </label>
                                    </div>
                                </div>

                                <div class="text-end">
                                    <button type="button" class="btn btn-secondary"
                                        data-bs-dismiss="modal">Annuler</button>
                                    <button type="submit"
                                        class="btn btn-primary">
                                        Enregistrer
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal confirmation suppression -->
            <div class="modal fade" id="deleteOrgModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">Supprimer le collectif</h5>
                            <button type="button" class="btn-close btn-close-white"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Êtes-vous sûr de vouloir supprimer le collectif
                                <strong id="delete-org-label"></strong> ?</p>
                            <p class="text-danger">
                                <i class="bi bi-exclamation-triangle"></i>
                                Cette action est irréversible. Toutes les données
                                (membres, événements, contributions) seront supprimées.
                            </p>
                            <input type="hidden" id="delete-org-id">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Annuler</button>
                            <button type="button" class="btn btn-danger"
                                id="confirm-delete-org-btn">
                                Supprimer définitivement
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        // Charger l'email du superadmin
        try {
            const { email } = await api.getSuperadminEmail();
            if (email) {
                const banner = document.getElementById(
                    'superadmin-email-banner'
                );
                const link = document.getElementById(
                    'superadmin-email-link'
                );
                link.textContent = email;
                link.href = `mailto:${email}`;
                banner.style.display = 'flex';
            }
        } catch (e) {
            // Ignorer si pas disponible
        }

        await this.loadOrgs();

        // Bouton nouveau collectif
        document.getElementById('new-org-btn')
            .addEventListener('click', () => {
                this.openNewOrgModal();
            });

        // Formulaire nouvelle org
        document.getElementById('new-org-form')
            .addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.createOrg();
            });

        // Formulaire édition org
        document.getElementById('edit-org-form')
            .addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveOrg();
            });

        // Upload logo dans modal édition
        document.getElementById('edit-org-logo')
            .addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.uploadLogo(file);
                }
            });

        // Confirmation suppression
        document.getElementById('confirm-delete-org-btn')
            .addEventListener('click', async () => {
                await this.deleteOrg();
            });
    }

    async openNewOrgModal() {
        // Reset le formulaire
        document.getElementById('new-org-form').reset();
        const modal = new bootstrap.Modal(
            document.getElementById('newOrgModal')
        );
        modal.show();
    }

    async createOrg() {
        const data = {
            id: document.getElementById('new-org-id').value.trim(),
            name: document.getElementById('new-org-name').value.trim(),
            label: document.getElementById('new-org-label').value.trim(),
            adminEmail: document.getElementById('new-org-adminEmail').value.trim(),
            defaultLanguage: document.getElementById(
                'new-org-defaultLanguage'
            ).value,
            registrationPassword: document.getElementById(
                'new-org-registrationPassword'
            ).value.trim(),
            contributionsEnabled: document.getElementById(
                'new-org-contributionsEnabled'
            ).checked
        };

        try {
            await api.createCollective(data);
            bootstrap.Modal.getInstance(
                document.getElementById('newOrgModal')
            ).hide();
            await this.loadOrgs();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    async loadOrgs() {
        try {
            const orgs = await api.getCollectives();
            const container = document.getElementById('orgs-container');

            if (orgs.length === 0) {
                container.innerHTML = `<div class="col"><p>
                    Aucun collectif trouvée.</p></div>`;
                return;
            }

            container.innerHTML = '';
            orgs.forEach(org => {
                const col = document.createElement('div');
                col.className = 'col-md-4 mb-4';
                const logo = org.logo || '/favicon.svg';
                col.innerHTML = `
                    <div class="card h-100">
                        <div class="card-body d-flex flex-column
                            align-items-center text-center">
                            <img src="${logo}" alt="Logo ${org.label}"
                                class="mb-3" style="max-height: 80px;">
                            <h5 class="card-title">${org.label}</h5>
                            <p class="card-text text-muted">${org.id}</p>
                            <div class="mt-auto d-flex flex-wrap gap-2 justify-content-center">
                                <button class="btn btn-sm btn-outline-primary
                                    edit-org-btn" data-collective-id="${org.id}">
                                    Modifier
                                </button>
                                <button class="btn btn-sm btn-outline-danger
                                    delete-org-btn" data-collective-id="${org.id}"
                                    data-org-label="${org.label}">
                                    Supprimer
                                </button>
                                <a href="/${org.id}" class="btn btn-sm btn-primary"
                                    data-link>Accéder</a>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(col);
            });

            // Event listeners pour les boutons
            document.querySelectorAll('.edit-org-btn')
                .forEach(btn => {
                    btn.addEventListener('click', () => {
                        this.openEditModal(btn.dataset.collectiveId);
                    });
                });

            document.querySelectorAll('.delete-org-btn')
                .forEach(btn => {
                    btn.addEventListener('click', () => {
                        this.openDeleteModal(
                            btn.dataset.collectiveId,
                            btn.dataset.orgLabel
                        );
                    });
                });
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    async openEditModal(collectiveId) {
        try {
            const orgs = await api.getCollectives();
            const org = orgs.find(o => o.id === collectiveId);
            if (!org) return;

            document.getElementById('edit-org-id').value = org.id;
            document.getElementById('edit-org-name').value = org.name || '';
            document.getElementById('edit-org-label').value = org.label || '';
            document.getElementById('edit-org-adminEmail').value =
                org.adminEmail || '';
            document.getElementById('edit-org-defaultLanguage').value =
                org.defaultLanguage || 'fr';
            document.getElementById('edit-org-registrationPassword').value =
                org.registrationPassword || '';
            document.getElementById('edit-org-contributionsEnabled').checked =
                org.contributionsEnabled !== false;
            document.getElementById('edit-org-logo-preview').src =
                org.logo || '/favicon.svg';

            const modal = new bootstrap.Modal(
                document.getElementById('editOrgModal')
            );
            modal.show();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    async openDeleteModal(collectiveId, orgLabel) {
        document.getElementById('delete-org-id').value = collectiveId;
        document.getElementById('delete-org-label').textContent = orgLabel;
        const modal = new bootstrap.Modal(
            document.getElementById('deleteOrgModal')
        );
        modal.show();
    }

    async deleteOrg() {
        const collectiveId = document.getElementById('delete-org-id').value;
        try {
            await api.deleteCollective(collectiveId);
            bootstrap.Modal.getInstance(
                document.getElementById('deleteOrgModal')
            ).hide();
            await this.loadOrgs();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    async uploadLogo(file) {
        if (file.size > 1 * 1024 * 1024) {
            alert(t("file_too_large"));
            return;
        }

        try {
            const collectiveId = document.getElementById('edit-org-id').value;
            const result = await api.uploadOrgLogo(collectiveId, file);
            document.getElementById('edit-org-logo-preview').src = result.logo;
        } catch (error) {
            alert(t("error_upload_logo") + ': ' + error.message);
        }
    }

    async saveOrg() {
        const collectiveId = document.getElementById('edit-org-id').value;
        const data = {
            name: document.getElementById('edit-org-name').value,
            label: document.getElementById('edit-org-label').value,
            adminEmail: document.getElementById('edit-org-adminEmail').value,
            defaultLanguage:
                document.getElementById('edit-org-defaultLanguage').value,
            registrationPassword:
                document.getElementById('edit-org-registrationPassword').value,
            contributionsEnabled: document.getElementById(
                'edit-org-contributionsEnabled'
            ).checked
        };

        try {
            await api.updateCollective(collectiveId, data);
            bootstrap.Modal.getInstance(
                document.getElementById('editOrgModal')
            ).hide();
            await this.loadOrgs();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }
}
