class HomeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("welcome"));
        this.orgId = params.orgId;
    }

    async getHtml() {
        let logo = "/favicon.svg";
        try {
            const orgs = await api.getOrganizations();
            const currentOrg = orgs.find(o => o.id === this.orgId);
            if (currentOrg && currentOrg.logo) {
                logo = currentOrg.logo;
            }
        } catch (error) {
            console.error("Erreur lors de la récupération de l'organisation", error);
        }

        return `
            <div class="p-5 mb-4 bg-light rounded-3 text-center">
                <div class="container-fluid py-5">
                    <img src="${logo}" alt="Logo" class="mb-4" style="max-height: 120px; max-width: 100%;">
                    <h1 class="display-5 fw-bold" data-i18n="welcome">${t("welcome")}</h1>
                    <p class="col-md-8 fs-4" data-i18n="welcome_desc">${t("welcome_desc")}</p>
                </div>
            </div>
        `;
    }
}
