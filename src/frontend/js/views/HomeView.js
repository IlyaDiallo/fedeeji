class HomeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("welcome"));
    }

    async getHtml() {
        return `
            <div class="p-5 mb-4 bg-light rounded-3">
                <div class="container-fluid py-5">
                    <h1 class="display-5 fw-bold" data-i18n="welcome">${t("welcome")}</h1>
                    <p class="col-md-8 fs-4" data-i18n="welcome_desc">${t("welcome_desc")}</p>
                </div>
            </div>
        `;
    }
}
