class OrgListView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("org_list_title"));
    }

    async getHtml() {
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="org_list_title">${t("org_list_title")}</h2>
            </div>
            <div class="row" id="orgs-container">
                <!-- Rempli dynamiquement -->
            </div>

            <!-- Modal d'édition organisation -->
            <div class="modal fade" id="editOrgModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Modifier l'organisation</h5>
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
        `;
    }

    async init() {
        await this.loadOrgs();

        document.getElementById('edit-org-form')
            .addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveOrg();
            });

        document.getElementById('edit-org-logo')
            .addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.uploadLogo(file);
                }
            });
    }

    async loadOrgs() {
        try {
            const orgs = await api.getOrganizations();
            const container = document.getElementById('orgs-container');

            if (orgs.length === 0) {
                container.innerHTML = `<div class="col"><p>
                    Aucune organisation trouvée.</p></div>`;
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
                            <div class="mt-auto d-flex gap-2">
                                <button class="btn btn-sm btn-outline-primary
                                    edit-org-btn" data-org-id="${org.id}">
                                    Modifier
                                </button>
                                <a href="/${org.id}" class="btn btn-sm btn-primary"
                                    data-link>Accéder</a>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(col);
            });

            document.querySelectorAll('.edit-org-btn')
                .forEach(btn => {
                    btn.addEventListener('click', () => {
                        this.openEditModal(btn.dataset.orgId);
                    });
                });
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    async openEditModal(orgId) {
        try {
            const orgs = await api.getOrganizations();
            const org = orgs.find(o => o.id === orgId);
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
            document.getElementById('edit-org-logo-preview').src =
                org.logo || '/favicon.svg';

            const modal = new bootstrap.Modal(
                document.getElementById('editOrgModal')
            );
            modal.show();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    async uploadLogo(file) {
        if (file.size > 1 * 1024 * 1024) {
            alert('Le fichier est trop volumineux (max 1 Mo)');
            return;
        }

        try {
            const orgId = document.getElementById('edit-org-id').value;
            const result = await api.uploadOrgLogo(orgId, file);
            document.getElementById('edit-org-logo-preview').src = result.logo;
        } catch (error) {
            alert('Erreur upload logo: ' + error.message);
        }
    }

    async saveOrg() {
        const orgId = document.getElementById('edit-org-id').value;
        const data = {
            name: document.getElementById('edit-org-name').value,
            label: document.getElementById('edit-org-label').value,
            adminEmail: document.getElementById('edit-org-adminEmail').value,
            defaultLanguage:
                document.getElementById('edit-org-defaultLanguage').value,
            registrationPassword:
                document.getElementById('edit-org-registrationPassword').value
        };

        try {
            await api.updateOrganization(orgId, data);
            bootstrap.Modal.getInstance(
                document.getElementById('editOrgModal')
            ).hide();
            await this.loadOrgs();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }
}
