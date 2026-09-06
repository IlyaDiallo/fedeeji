class CollectiveListView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("collective_list_title"));
        this.logoSelections = { new: null, edit: null };
        this.logoSelectionManual = { new: false, edit: false };
        this.logoSearchResults = { new: [], edit: [] };
    }

    static escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    static deriveSecondary(primary) {
        const normalized = String(primary || '').toLowerCase();
        if (normalized === '#5b55e7') return '#08a88a';
        if (!/^#[0-9a-f]{6}$/.test(normalized)) return '#08a88a';
        const value = parseInt(normalized.slice(1), 16);
        const rgb = [
            (value >> 16) & 255, (value >> 8) & 255, value & 255
        ].map(channel => channel / 255);
        const max = Math.max(...rgb);
        const min = Math.min(...rgb);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const delta = max - min;
            s = l > 0.5
                ? delta / (2 - max - min)
                : delta / (max + min);
            if (max === rgb[0]) {
                h = (rgb[1] - rgb[2]) / delta + (rgb[1] < rgb[2] ? 6 : 0);
            } else if (max === rgb[1]) {
                h = (rgb[2] - rgb[0]) / delta + 2;
            } else {
                h = (rgb[0] - rgb[1]) / delta + 4;
            }
            h *= 60;
        }
        h = ((h - 72) % 360 + 360) % 360;
        s = Math.min(82, Math.max(58, s * 100 + 10)) / 100;
        const lightness = Math.min(54, Math.max(36, l * 100 - 8)) / 100;
        const chroma = (1 - Math.abs(2 * lightness - 1)) * s;
        const section = h / 60;
        const x = chroma * (1 - Math.abs((section % 2) - 1));
        const channels = section < 1 ? [chroma, x, 0]
            : section < 2 ? [x, chroma, 0]
                : section < 3 ? [0, chroma, x]
                    : section < 4 ? [0, x, chroma]
                        : section < 5 ? [x, 0, chroma]
                            : [chroma, 0, x];
        const match = lightness - chroma / 2;
        return '#' + channels.map(channel =>
            Math.round((channel + match) * 255)
                .toString(16).padStart(2, '0')
        ).join('');
    }

    updateThemePreview(prefix) {
        const input = document.getElementById(`${prefix}-org-primaryColor`);
        const preview = document.getElementById(`${prefix}-org-theme-preview`);
        if (!input || !preview) return;
        const primary = input.value.toLowerCase();
        const secondary = CollectiveListView.deriveSecondary(primary);
        preview.style.setProperty('--preview-primary', primary);
        preview.style.setProperty('--preview-secondary', secondary);
        preview.querySelector('[data-primary-value]').textContent = primary;
        preview.querySelector('[data-secondary-value]').textContent = secondary;
    }

    themeFieldHtml(prefix) {
        return `
            <div class="mb-3 theme-color-field">
                <label class="form-label" for="${prefix}-org-primaryColor">
                    ${t('primary_color')}</label>
                <div class="d-flex align-items-center gap-3">
                    <input type="color" class="form-control form-control-color"
                        id="${prefix}-org-primaryColor" value="#5b55e7"
                        title="${t('primary_color')}">
                    <div class="theme-palette-preview flex-grow-1"
                        id="${prefix}-org-theme-preview"
                        style="--preview-primary:#5b55e7;
                            --preview-secondary:#08a88a">
                        <span class="theme-swatch swatch-primary"></span>
                        <span class="theme-swatch swatch-secondary"></span>
                        <small>
                            <span data-primary-value>#5b55e7</span>
                            <i class="bi bi-plus"></i>
                            <span data-secondary-value>#08a88a</span>
                        </small>
                    </div>
                </div>
                <small class="text-muted">
                    ${t('secondary_color_auto')}</small>
            </div>`;
    }

    typeFieldHtml(prefix) {
        return `
            <div class="mb-3">
                <label class="form-label" for="${prefix}-org-typeLabel">
                    Type de collectif *</label>
                <input type="text" class="form-control"
                    id="${prefix}-org-typeLabel"
                    list="collective-type-suggestions"
                    maxlength="48" placeholder="ex: association" required>
                <small class="text-muted">
                    Terme concret affiché dans l’espace : association, club,
                    équipe, famille…
                </small>
            </div>`;
    }

    static defaultLogoRecipe(typeLabel = 'groupe', source = 'logo') {
        const normalized = String(typeLabel)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const name = /club|sport/.test(normalized)
            ? 'ball-football'
            : /ecole|school|formation/.test(normalized)
                ? 'school'
                : /famille|family|maison|home/.test(normalized)
                    ? 'home-heart'
                    : /residence|copro|habitat|cooperat/.test(normalized)
                        ? 'building-community'
                        : 'users-group';
        return {
            collection: 'tabler',
            name,
            style: 'doodle-v1',
            seed: IllustrationPicker.seedFrom(`${source}:${typeLabel}`)
        };
    }

    static logoPreviewUrl(recipe, color, compact = false) {
        const safeRecipe = recipe
            || CollectiveListView.defaultLogoRecipe();
        const params = new URLSearchParams({
            seed: String(safeRecipe.seed),
            style: safeRecipe.style || 'doodle-v1',
            color: color || '#5b55e7'
        });
        if (compact) params.set('variant', 'compact');
        return `/api/illustrations/${encodeURIComponent(safeRecipe.name)}.svg?${params}`;
    }

    logoFieldHtml(prefix, { allowUpload = false } = {}) {
        const recipe = CollectiveListView.defaultLogoRecipe();
        const preview = CollectiveListView.logoPreviewUrl(
            recipe, '#5b55e7'
        );
        return `
            <div class="mb-3 collective-logo-field">
                <label class="form-label">Logo</label>
                <div class="action-illustration-selection">
                    <div class="action-illustration-preview collective-logo-preview">
                        <img id="${prefix}-org-logo-preview"
                            src="${preview}" alt="">
                    </div>
                    <div class="flex-grow-1">
                        <strong id="${prefix}-org-logo-name">Groupe</strong>
                        <p class="small text-muted mb-2">
                            Illustration locale aux couleurs de l’espace.</p>
                        <button type="button" class="btn btn-sm
                            btn-outline-primary"
                            id="${prefix}-browse-org-logos">
                            <i class="bi bi-brush"></i>
                            Choisir une illustration
                        </button>
                    </div>
                </div>
                ${allowUpload ? `
                    <div class="mt-2">
                        <label class="form-label small mb-1"
                            for="edit-org-logo">
                            Ou importer une image (max 1 Mo)
                        </label>
                        <input type="file" class="form-control"
                            id="edit-org-logo" accept="image/*">
                    </div>` : ''}
            </div>`;
    }

    logoPickerPanelHtml(prefix) {
        return `
            <section id="${prefix}-org-logo-picker"
                class="illustration-picker d-none"
                aria-labelledby="${prefix}-org-logo-picker-title">
                <div class="d-flex align-items-center gap-3 mb-3">
                    <button type="button" class="btn btn-icon btn-light"
                        id="${prefix}-close-org-logo-picker"
                        aria-label="Retour">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h5 class="mb-0"
                            id="${prefix}-org-logo-picker-title">
                            Choisir un logo</h5>
                        <small class="text-muted">
                            Bibliothèque locale d’illustrations</small>
                    </div>
                </div>
                <form id="${prefix}-org-logo-search"
                    class="asset-search mb-3">
                    <div class="input-group input-group-lg">
                        <span class="input-group-text">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="search" class="form-control"
                            id="${prefix}-org-logo-query"
                            placeholder="ex: association, sport, maison…">
                        <button class="btn btn-primary" type="submit"
                            id="${prefix}-org-logo-search-btn">
                            Rechercher</button>
                    </div>
                </form>
                <div id="${prefix}-org-logo-status"
                    class="small text-muted mb-2"></div>
                <div id="${prefix}-org-logo-results"
                    class="asset-grid illustration-grid"></div>
            </section>`;
    }

    async getHtml() {
        return `
            <datalist id="collective-type-suggestions">
                <option value="association"></option>
                <option value="club"></option>
                <option value="groupe"></option>
                <option value="équipe"></option>
                <option value="famille"></option>
                <option value="école"></option>
                <option value="résidence"></option>
                <option value="coopérative"></option>
            </datalist>
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
                <div class="modal-dialog modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Nouveau collectif</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${this.logoPickerPanelHtml('new')}
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

                                ${this.typeFieldHtml('new')}
                                ${this.themeFieldHtml('new')}
                                ${this.logoFieldHtml('new')}

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
                <div class="modal-dialog modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Modifier le collectif</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${this.logoPickerPanelHtml('edit')}
                            <form id="edit-org-form">
                                <input type="hidden" id="edit-org-id">

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

                                ${this.typeFieldHtml('edit')}
                                ${this.themeFieldHtml('edit')}
                                ${this.logoFieldHtml('edit', { allowUpload: true })}

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

        ['new', 'edit'].forEach(prefix => {
            document.getElementById(`${prefix}-org-primaryColor`)
                .addEventListener('input', () => {
                    this.updateThemePreview(prefix);
                    this.refreshLogoPreview(prefix);
                });
            document.getElementById(`${prefix}-browse-org-logos`)
                .addEventListener('click', () =>
                    this.openLogoPicker(prefix));
            document.getElementById(`${prefix}-close-org-logo-picker`)
                .addEventListener('click', () =>
                    this.closeLogoPicker(prefix));
            document.getElementById(`${prefix}-org-logo-search`)
                .addEventListener('submit', event => {
                    event.preventDefault();
                    this.searchLogos(prefix);
                });
            this.updateThemePreview(prefix);
        });

        document.getElementById('new-org-typeLabel')
            .addEventListener('input', () => {
                if (!this.logoSelectionManual.new) {
                    this.useDefaultLogo('new');
                }
            });
        document.getElementById('new-org-id')
            .addEventListener('input', () => {
                if (!this.logoSelectionManual.new) {
                    this.useDefaultLogo('new');
                }
            });

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

    setLogoSelection(prefix, recipe, label = '', { manual = true } = {}) {
        this.logoSelections[prefix] = recipe ? { ...recipe } : null;
        this.logoSelectionManual[prefix] = manual;
        const name = document.getElementById(`${prefix}-org-logo-name`);
        if (name) {
            name.textContent = label
                || recipe?.name?.split('-').join(' ')
                || 'Logo importé';
        }
        this.refreshLogoPreview(prefix);
    }

    refreshLogoPreview(prefix) {
        const recipe = this.logoSelections[prefix];
        const image = document.getElementById(`${prefix}-org-logo-preview`);
        const color = document.getElementById(
            `${prefix}-org-primaryColor`
        )?.value;
        if (!recipe || !image) return;
        image.src = CollectiveListView.logoPreviewUrl(
            recipe, color || '#5b55e7'
        );
    }

    useDefaultLogo(prefix) {
        const typeLabel = document.getElementById(
            `${prefix}-org-typeLabel`
        )?.value || 'groupe';
        const source = document.getElementById(`${prefix}-org-id`)
            ?.value || prefix;
        const recipe = CollectiveListView.defaultLogoRecipe(
            typeLabel, source
        );
        this.setLogoSelection(prefix, recipe, typeLabel, { manual: false });
    }

    async openLogoPicker(prefix) {
        document.getElementById(`${prefix}-org-logo-picker`)
            .classList.remove('d-none');
        document.getElementById(`${prefix}-org-form`)
            .classList.add('d-none');
        const query = document.getElementById(`${prefix}-org-logo-query`);
        query.value = document.getElementById(
            `${prefix}-org-typeLabel`
        ).value.trim();
        await this.searchLogos(prefix);
    }

    closeLogoPicker(prefix) {
        document.getElementById(`${prefix}-org-logo-picker`)
            .classList.add('d-none');
        document.getElementById(`${prefix}-org-form`)
            .classList.remove('d-none');
    }

    async searchLogos(prefix) {
        const query = document.getElementById(
            `${prefix}-org-logo-query`
        ).value.trim();
        const color = document.getElementById(
            `${prefix}-org-primaryColor`
        ).value;
        const status = document.getElementById(`${prefix}-org-logo-status`);
        const container = document.getElementById(
            `${prefix}-org-logo-results`
        );
        const button = document.getElementById(
            `${prefix}-org-logo-search-btn`
        );
        button.disabled = true;
        status.innerHTML = `<span class="spinner-border spinner-border-sm"
            aria-hidden="true"></span> ${t('loading')}`;
        container.innerHTML = Array.from({ length: 8 }, () =>
            '<div class="asset-result-card asset-skeleton"></div>'
        ).join('');
        try {
            const result = await api.searchCollectiveLogos({
                query, lang: i18n.lang, limit: 36, color
            });
            this.logoSearchResults[prefix] = result.items || [];
            this.renderLogoResults(prefix);
            status.textContent = this.logoSearchResults[prefix].length
                ? `${this.logoSearchResults[prefix].length} résultats`
                : 'Aucune illustration trouvée';
        } catch (error) {
            this.logoSearchResults[prefix] = [];
            container.innerHTML = '';
            status.textContent = `${t('error')}: ${error.message}`;
        } finally {
            button.disabled = false;
        }
    }

    renderLogoResults(prefix) {
        const E = CollectiveListView.escape;
        const container = document.getElementById(
            `${prefix}-org-logo-results`
        );
        container.innerHTML = this.logoSearchResults[prefix]
            .map((item, index) => `
                <button type="button" class="asset-result-card
                    illustration-result-card" data-index="${index}">
                    <span class="asset-result-image">
                        <img src="${E(item.previewUrl)}" loading="lazy" alt="">
                        <span class="asset-use-label">
                            <i class="bi bi-check2"></i> Choisir
                        </span>
                    </span>
                    <span class="asset-result-info">
                        <strong>${E(item.label)}</strong>
                        <small>${E(item.name)}</small>
                    </span>
                </button>`).join('');
        container.querySelectorAll('.illustration-result-card')
            .forEach(button => button.addEventListener('click', () => {
                const item = this.logoSearchResults[prefix][
                    Number(button.dataset.index)
                ];
                this.setLogoSelection(prefix, {
                    collection: item.collection,
                    name: item.name,
                    style: item.style,
                    seed: item.seed
                }, item.label);
                this.closeLogoPicker(prefix);
            }));
    }

    async openNewOrgModal() {
        // Reset le formulaire
        document.getElementById('new-org-form').reset();
        document.getElementById('new-org-typeLabel').value = 'association';
        document.getElementById('new-org-primaryColor').value = '#5b55e7';
        this.logoSelectionManual.new = false;
        this.useDefaultLogo('new');
        this.updateThemePreview('new');
        this.closeLogoPicker('new');
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
            typeLabel: document.getElementById(
                'new-org-typeLabel'
            ).value.trim(),
            logoIllustration: this.logoSelections.new,
            adminEmail: document.getElementById('new-org-adminEmail').value.trim(),
            defaultLanguage: document.getElementById(
                'new-org-defaultLanguage'
            ).value,
            registrationPassword: document.getElementById(
                'new-org-registrationPassword'
            ).value.trim(),
            contributionsEnabled: document.getElementById(
                'new-org-contributionsEnabled'
            ).checked,
            primaryColor: document.getElementById(
                'new-org-primaryColor'
            ).value
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
                const logo = org.logoIllustration
                    ? IllustrationPicker.previewUrl(
                        org.id, org.logoIllustration, false
                    )
                    : (org.logo || '/favicon.svg');
                col.innerHTML = `
                    <div class="card h-100">
                        <div class="card-body d-flex flex-column
                            align-items-center text-center">
                            <img src="${logo}" alt="Logo ${org.label}"
                                class="mb-3" style="max-height: 80px;">
                            <h5 class="card-title">${org.label}</h5>
                            <span class="badge bg-light text-dark mb-2">
                                ${CollectiveListView.escape(org.typeLabel)}
                            </span>
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
            document.getElementById('edit-org-typeLabel').value =
                org.typeLabel || 'groupe';
            document.getElementById('edit-org-primaryColor').value =
                org.primaryColor || '#5b55e7';
            this.updateThemePreview('edit');
            document.getElementById('edit-org-adminEmail').value =
                org.adminEmail || '';
            document.getElementById('edit-org-defaultLanguage').value =
                org.defaultLanguage || 'fr';
            document.getElementById('edit-org-registrationPassword').value =
                org.registrationPassword || '';
            document.getElementById('edit-org-contributionsEnabled').checked =
                org.contributionsEnabled !== false;
            if (org.logoIllustration) {
                this.setLogoSelection(
                    'edit', org.logoIllustration,
                    org.logoIllustration.name.split('-').join(' ')
                );
            } else {
                this.logoSelections.edit = null;
                this.logoSelectionManual.edit = true;
                document.getElementById('edit-org-logo-preview').src =
                    org.logo || '/favicon.svg';
                document.getElementById('edit-org-logo-name').textContent =
                    org.logo ? 'Logo importé' : 'Logo Feddeeji';
            }
            this.closeLogoPicker('edit');

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
            this.logoSelections.edit = null;
            this.logoSelectionManual.edit = true;
            document.getElementById('edit-org-logo-preview').src = result.logo;
            document.getElementById('edit-org-logo-name').textContent =
                'Logo importé';
        } catch (error) {
            alert(t("error_upload_logo") + ': ' + error.message);
        }
    }

    async saveOrg() {
        const collectiveId = document.getElementById('edit-org-id').value;
        const data = {
            name: document.getElementById('edit-org-name').value,
            label: document.getElementById('edit-org-label').value,
            typeLabel: document.getElementById(
                'edit-org-typeLabel'
            ).value.trim(),
            logoIllustration: this.logoSelections.edit,
            adminEmail: document.getElementById('edit-org-adminEmail').value,
            defaultLanguage:
                document.getElementById('edit-org-defaultLanguage').value,
            registrationPassword:
                document.getElementById('edit-org-registrationPassword').value,
            contributionsEnabled: document.getElementById(
                'edit-org-contributionsEnabled'
            ).checked,
            primaryColor: document.getElementById(
                'edit-org-primaryColor'
            ).value
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
