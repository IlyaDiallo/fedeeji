class HomeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("welcome"));
        this.collectiveId = params.collectiveId;
    }

    async getHtml() {
        let logo = "/favicon.svg";
        let orgLabel = null;
        try {
            const orgs = await api.getCollectives();
            const currentOrg = orgs.find(o => o.id === this.collectiveId);
            if (currentOrg?.logo) logo = currentOrg.logo;
            if (currentOrg?.label) orgLabel = currentOrg.label;
        } catch (error) {
            console.error("Erreur lors de la récupération du collectif", error);
        }

        const title = orgLabel || t("welcome");

        return `
            <div class="p-5 mb-4 bg-light rounded-3 text-center">
                <div class="container-fluid py-5">
                    <img src="${logo}" alt="Logo" class="mb-4" style="max-height: 200px; max-width: 100%;">
                    <h1 class="display-5 fw-bold">${title}</h1>
                    <p class="col-md-8 fs-4" data-i18n="welcome_desc">${t("welcome_desc")}</p>
                </div>
            </div>
        `;
    }
}
