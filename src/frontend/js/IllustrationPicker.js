/** Sélecteur local d'illustrations dessinées pour les actions. */
class IllustrationPicker {
    constructor({ collectiveId, onSelect }) {
        this.collectiveId = collectiveId;
        this.onSelect = onSelect;
        this.selected = null;
        this.results = [];
        this.requestSequence = 0;
        this.suggestionSequence = 0;
        this.suggestionTimer = null;
    }

    static escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    static seedFrom(value) {
        let hash = 2166136261;
        for (const char of String(value || 'action')) {
            hash ^= char.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0) % 1000000;
    }

    static defaultRecipe(source = 'action') {
        return {
            collection: 'tabler',
            name: 'clipboard-check',
            style: 'doodle-v1',
            seed: IllustrationPicker.seedFrom(source)
        };
    }

    static previewUrl(collectiveId, recipe, compact = false) {
        const safeRecipe = recipe || IllustrationPicker.defaultRecipe();
        const params = new URLSearchParams({
            seed: String(safeRecipe.seed),
            style: safeRecipe.style || 'doodle-v1'
        });
        if (compact) params.set('variant', 'compact');
        return `/api/${encodeURIComponent(collectiveId)}`
            + `/illustrations/${encodeURIComponent(safeRecipe.name)}.svg?${params}`;
    }

    static fieldHtml() {
        return `
            <div class="mb-3 action-illustration-field">
                <label class="form-label">${t('task_illustration')}</label>
                <div class="action-illustration-selection">
                    <div id="action-illustration-preview"
                        class="action-illustration-preview"></div>
                    <div class="flex-grow-1">
                        <strong id="action-illustration-name"></strong>
                        <p class="small text-muted mb-2">
                            ${t('task_illustration_help')}</p>
                        <button type="button" class="btn btn-sm
                            btn-outline-primary" id="btn-browse-illustrations">
                            <i class="bi bi-brush"></i>
                            ${t('choose_illustration')}
                        </button>
                    </div>
                </div>
                <div id="action-illustration-suggestions"
                    class="illustration-suggestions mt-2"></div>
            </div>`;
    }

    static panelHtml() {
        return `
            <section id="illustration-picker-panel"
                class="illustration-picker d-none"
                aria-labelledby="illustration-picker-title">
                <div class="d-flex align-items-center gap-3 mb-3">
                    <button type="button" class="btn btn-icon btn-light"
                        id="btn-close-illustration-picker"
                        aria-label="${t('back')}">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h5 class="mb-0" id="illustration-picker-title">
                            ${t('illustration_library')}</h5>
                        <small class="text-muted">
                            ${t('illustration_library_help')}</small>
                    </div>
                </div>
                <form id="illustration-search-form" class="asset-search mb-3">
                    <div class="input-group input-group-lg">
                        <span class="input-group-text">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="search" class="form-control"
                            id="illustration-search-input"
                            placeholder="${t('illustration_search_placeholder')}">
                        <button class="btn btn-primary" type="submit"
                            id="btn-search-illustrations">
                            ${t('search')}</button>
                    </div>
                </form>
                <div id="illustration-search-status"
                    class="small text-muted mb-2"></div>
                <div id="illustration-search-results"
                    class="asset-grid illustration-grid"></div>
                <p class="asset-provider-note">
                    <i class="bi bi-wifi-off"></i>
                    ${t('illustration_local_note')}
                </p>
            </section>`;
    }

    init() {
        document.getElementById('btn-browse-illustrations')
            ?.addEventListener('click', () => {
                const query = document.getElementById('action-name')
                    ?.value.trim() || '';
                this.open(query);
            });
        document.getElementById('btn-close-illustration-picker')
            ?.addEventListener('click', () => this.close());
        document.getElementById('illustration-search-form')
            ?.addEventListener('submit', event => {
                event.preventDefault();
                this.search(document.getElementById(
                    'illustration-search-input').value);
            });
        document.getElementById('actionModal')
            ?.addEventListener('hidden.bs.modal', () => this.close());
    }

    previewUrl(recipe, compact = false) {
        return IllustrationPicker.previewUrl(
            this.collectiveId, recipe, compact
        );
    }

    setSelected(recipe, { notify = false, label = '' } = {}) {
        this.selected = recipe || IllustrationPicker.defaultRecipe();
        const preview = document.getElementById('action-illustration-preview');
        const name = document.getElementById('action-illustration-name');
        if (preview) {
            preview.innerHTML = `<img src="${this.previewUrl(this.selected)}"
                alt="">`;
        }
        if (name) {
            name.textContent = label
                || this.selected.name.split('-').join(' ');
        }
        if (notify) this.onSelect?.({ ...this.selected });
    }

    open(query = '') {
        document.getElementById('illustration-picker-panel')
            ?.classList.remove('d-none');
        document.getElementById('action-form')?.classList.add('d-none');
        document.getElementById('action-modal-footer')
            ?.classList.add('d-none');
        const input = document.getElementById('illustration-search-input');
        if (input) input.value = query;
        this.search(query);
    }

    close() {
        document.getElementById('illustration-picker-panel')
            ?.classList.add('d-none');
        document.getElementById('action-form')?.classList.remove('d-none');
        document.getElementById('action-modal-footer')
            ?.classList.remove('d-none');
    }

    async search(query = '') {
        const sequence = ++this.requestSequence;
        const status = document.getElementById('illustration-search-status');
        const button = document.getElementById('btn-search-illustrations');
        const container = document.getElementById(
            'illustration-search-results'
        );
        if (!container || !status) return;
        button.disabled = true;
        status.innerHTML = `<span class="spinner-border spinner-border-sm"
            aria-hidden="true"></span> ${t('loading')}`;
        container.innerHTML = Array.from({ length: 8 }, () =>
            `<div class="asset-result-card asset-skeleton"></div>`
        ).join('');
        try {
            const result = await api.searchIllustrations(this.collectiveId, {
                query: query.trim(), lang: i18n.lang, limit: 36
            });
            if (sequence !== this.requestSequence) return;
            this.results = result.items || [];
            this.renderResults();
            status.textContent = this.results.length
                ? `${this.results.length} ${t('illustrations_found')}`
                : t('no_illustrations_found');
        } catch (error) {
            if (sequence !== this.requestSequence) return;
            this.results = [];
            container.innerHTML = '';
            status.textContent = `${t('error')}: ${error.message}`;
            status.classList.add('text-danger');
        } finally {
            if (sequence === this.requestSequence) button.disabled = false;
        }
    }

    renderResults() {
        const E = IllustrationPicker.escape;
        const container = document.getElementById(
            'illustration-search-results'
        );
        const status = document.getElementById('illustration-search-status');
        status?.classList.remove('text-danger');
        if (!container) return;
        container.innerHTML = this.results.map((item, index) => `
            <button type="button" class="asset-result-card
                illustration-result-card" data-index="${index}">
                <span class="asset-result-image">
                    <img src="${E(item.previewUrl)}" loading="lazy" alt="">
                    <span class="asset-use-label">
                        <i class="bi bi-check2"></i> ${t('use_illustration')}
                    </span>
                </span>
                <span class="asset-result-info">
                    <strong>${E(item.label)}</strong>
                    <small>${E(item.name)}</small>
                </span>
            </button>`).join('');
        container.querySelectorAll('.illustration-result-card')
            .forEach(button => button.addEventListener('click', () => {
                const item = this.results[Number(button.dataset.index)];
                this.choose(item);
            }));
    }

    choose(item) {
        if (!item) return;
        const recipe = {
            collection: item.collection,
            name: item.name,
            style: item.style,
            seed: item.seed
        };
        this.setSelected(recipe, { notify: true, label: item.label });
        this.close();
        document.getElementById('action-illustration-suggestions')
            ?.replaceChildren();
    }

    suggestFromName(query) {
        clearTimeout(this.suggestionTimer);
        const sequence = ++this.suggestionSequence;
        const container = document.getElementById(
            'action-illustration-suggestions'
        );
        if (!container) return;
        if (query.trim().length < 2) {
            container.replaceChildren();
            return;
        }
        this.suggestionTimer = setTimeout(async () => {
            try {
                const result = await api.searchIllustrations(
                    this.collectiveId,
                    { query: query.trim(), lang: i18n.lang, limit: 6 }
                );
                if (sequence === this.suggestionSequence) {
                    this.renderSuggestions((result.items || []).slice(0, 4));
                }
            } catch {
                if (sequence === this.suggestionSequence) {
                    container.replaceChildren();
                }
            }
        }, 280);
    }

    renderSuggestions(items) {
        const E = IllustrationPicker.escape;
        const container = document.getElementById(
            'action-illustration-suggestions'
        );
        if (!container) return;
        if (!items.length) {
            container.replaceChildren();
            return;
        }
        container.innerHTML = `<small>${t('suggestions')} :</small>`
            + items.map((item, index) => `
                <button type="button" class="illustration-suggestion"
                    data-index="${index}" title="${E(item.label)}">
                    <img src="${E(item.previewUrl)}" alt="">
                    <span>${E(item.label)}</span>
                </button>`).join('');
        container.querySelectorAll('.illustration-suggestion')
            .forEach(button => button.addEventListener('click', () =>
                this.choose(items[Number(button.dataset.index)])));
    }
}
