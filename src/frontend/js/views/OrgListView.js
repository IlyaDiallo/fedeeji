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
        `;
    }

    async init() {
        try {
            const orgs = await api.getOrganizations();
            const container = document.getElementById('orgs-container');
            
            if (orgs.length === 0) {
                container.innerHTML = `<div class="col"><p>Aucune organisation trouvée.</p></div>`;
                return;
            }

            orgs.forEach(org => {
                const col = document.createElement('div');
                col.className = 'col-md-4 mb-4';
                col.innerHTML = `
                    <div class="card h-100">
                        <div class="card-body">
                            <h5 class="card-title">${org.label}</h5>
                            <p class="card-text text-muted">${org.id}</p>
                            <a href="/${org.id}" class="btn btn-primary" data-link>Accéder</a>
                        </div>
                    </div>
                `;
                container.appendChild(col);
            });
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }
}
