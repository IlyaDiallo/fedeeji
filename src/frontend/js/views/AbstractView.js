class AbstractView {
    constructor(params) {
        this.params = params;
        this.collectiveId = params.collectiveId;
        this.isMember = api.getRole() === 'member';
    }

    setTitle(title) {
        document.title = title;
    }

    /** Locale pour les formatages de dates (dépend de la langue active) */
    get locale() {
        return i18n.lang === 'en' ? 'en-US' : 'fr-FR';
    }

    async getHtml() {
        return "";
    }

    async init() {
        // Pour initialiser les event listeners après le rendu
    }
}
