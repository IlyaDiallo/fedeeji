class AbstractView {
    constructor(params) {
        this.params = params;
    }

    setTitle(title) {
        document.title = title;
    }

    async getHtml() {
        return "";
    }

    async init() {
        // Pour initialiser les event listeners après le rendu
    }
}
