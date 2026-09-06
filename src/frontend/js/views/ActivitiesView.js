class ActivitiesView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("activities") + " - " + t("brand"));
        this.activities = [];
        this.members = [];
        // État du formulaire (structure dynamique : étapes + images)
        this.form = null;
        this.assetTarget = null;
        this.assetResults = [];
        this.assetSearchPage = 1;
        this.assetHasMore = false;
    }

    static escape(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    static safeUrl(value) {
        if (!value) return '';
        try {
            const url = new URL(value, window.location.origin);
            return ['http:', 'https:'].includes(url.protocol)
                ? url.href : '';
        } catch {
            return '';
        }
    }

    static colorHue(value) {
        return Array.from(String(value || 'activity')).reduce(
            (hash, char) => ((hash * 31) + char.charCodeAt(0)) % 360,
            168
        );
    }

    attributionHtml(attribution) {
        if (!attribution) return '';
        const E = ActivitiesView.escape;
        const sourceUrl = ActivitiesView.safeUrl(attribution.sourceUrl);
        const licenseUrl = ActivitiesView.safeUrl(attribution.licenseUrl);
        const author = E(attribution.author || attribution.provider || '');
        const license = E(attribution.license || '');
        const authorHtml = sourceUrl && author
            ? `<a href="${E(sourceUrl)}" target="_blank"
                rel="noopener noreferrer">${author}</a>`
            : author;
        const licenseHtml = licenseUrl && license
            ? `<a href="${E(licenseUrl)}" target="_blank"
                rel="noopener noreferrer">${license}</a>`
            : license;
        const separator = authorHtml && licenseHtml ? ' · ' : '';
        return `<small class="asset-attribution">
            <i class="bi bi-info-circle"></i>
            ${authorHtml}${separator}${licenseHtml}</small>`;
    }

    async getHtml() {
        const addBtn = this.isMember ? '' : `
            <button class="btn btn-primary" id="btn-add-activity">
                <i class="bi bi-plus-lg"></i>
                <span class="d-none d-md-inline" data-i18n="add">
                    ${t("add")}</span>
            </button>`;

        const adminModal = this.isMember ? '' : this.modalHtml();

        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="activities">${t("activities")}</h2>
                ${addBtn}
            </div>
            <div id="activities-list" class="row g-3"></div>
            ${adminModal}
        `;
    }

    modalHtml() {
        return `
            <div class="modal fade" id="activityModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="activityModalTitle">
                                ${t("add_edit_activity")}</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <section id="asset-picker-panel"
                                class="asset-picker d-none"
                                aria-labelledby="asset-picker-title">
                                <div class="d-flex align-items-center gap-3 mb-3">
                                    <button type="button"
                                        class="btn btn-icon btn-light"
                                        id="btn-close-asset-picker"
                                        aria-label="${t("back")}">
                                        <i class="bi bi-arrow-left"></i>
                                    </button>
                                    <div>
                                        <h5 class="mb-0" id="asset-picker-title">
                                            ${t("image_library")}</h5>
                                        <small class="text-muted">
                                            ${t("image_library_help")}</small>
                                    </div>
                                </div>
                                <form id="asset-search-form"
                                    class="asset-search mb-3">
                                    <div class="input-group input-group-lg">
                                        <span class="input-group-text">
                                            <i class="bi bi-search"></i>
                                        </span>
                                        <input type="search" class="form-control"
                                            id="asset-search-input"
                                            placeholder="${t("asset_search_placeholder")}">
                                        <button class="btn btn-primary"
                                            id="btn-search-assets" type="submit">
                                            ${t("search")}</button>
                                    </div>
                                </form>
                                <div id="asset-search-status"
                                    class="small text-muted mb-2"></div>
                                <div id="asset-search-results"
                                    class="asset-grid"></div>
                                <div class="text-center mt-3">
                                    <button type="button"
                                        class="btn btn-outline-primary d-none"
                                        id="btn-load-more-assets">
                                        ${t("load_more")}</button>
                                </div>
                                <p class="asset-provider-note">
                                    <i class="bi bi-globe2"></i>
                                    ${t("asset_provider_label")}
                                </p>
                            </section>
                            <form id="activity-form">
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="activity_title">
                                        ${t("activity_title")}</label>
                                    <input type="text"
                                        class="form-control"
                                        id="activity-title" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="activity_image">
                                        ${t("activity_image")}</label>
                                    <div id="activity-image-preview"
                                        class="mb-2"></div>
                                    <div class="asset-actions">
                                        <label class="btn btn-outline-secondary">
                                            <i class="bi bi-upload"></i>
                                            ${t("upload_image")}
                                            <input type="file" accept="image/*"
                                                hidden id="activity-image-input">
                                        </label>
                                        <button type="button"
                                            class="btn btn-outline-primary"
                                            id="btn-browse-activity-assets">
                                            <i class="bi bi-images"></i>
                                            ${t("choose_from_library")}
                                        </button>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="long_description">
                                        ${t("long_description")}</label>
                                    <textarea class="form-control" rows="3"
                                        id="activity-description"></textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="duration">
                                        ${t("duration")}</label>
                                    <div class="input-group"
                                        style="max-width:280px;">
                                        <input type="number" min="1"
                                            class="form-control"
                                            id="activity-duration">
                                        <select class="form-select"
                                            id="activity-duration-unit">
                                            <option value="minutes">
                                                ${t("minutes")}</option>
                                            <option value="hours">
                                                ${t("hours")}</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="assigned_members">
                                        ${t("assigned_members")}</label>
                                    <div id="activity-members"
                                        class="border rounded p-2"
                                        style="max-height:160px;
                                            overflow-y:auto;"></div>
                                </div>
                                <div class="mb-3 form-check form-switch">
                                    <input class="form-check-input"
                                        type="checkbox"
                                        id="activity-no-timer">
                                    <label class="form-check-label"
                                        for="activity-no-timer"
                                        data-i18n="no_timer">
                                        ${t("no_timer")}</label>
                                </div>
                                <div class="mb-3 form-check form-switch">
                                    <input class="form-check-input"
                                        type="checkbox"
                                        id="activity-track-history">
                                    <label class="form-check-label"
                                        for="activity-track-history"
                                        data-i18n="track_history">
                                        ${t("track_history")}</label>
                                </div>
                                <hr>
                                <div class="d-flex justify-content-between
                                    align-items-center mb-2">
                                    <h6 class="mb-0" data-i18n="steps">
                                        ${t("steps")}</h6>
                                    <button type="button"
                                        class="btn btn-sm btn-outline-primary"
                                        id="btn-add-step">
                                        <i class="bi bi-plus-lg"></i>
                                        ${t("add_step")}</button>
                                </div>
                                <div id="activity-steps"></div>
                            </form>
                        </div>
                        <div class="modal-footer" id="activity-modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal"
                                data-i18n="cancel">${t("cancel")}</button>
                            <button type="button" class="btn btn-primary"
                                id="btn-save-activity"
                                data-i18n="save">${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        await this.loadActivities();

        if (this.isMember) return;

        try {
            this.members = await api.get(this.collectiveId, 'members');
        } catch (e) {
            this.members = [];
        }

        this.modal = new bootstrap.Modal(
            document.getElementById('activityModal')
        );

        document.getElementById('btn-add-activity')
            .addEventListener('click', () => this.openModal());
        document.getElementById('btn-save-activity')
            .addEventListener('click', () => this.save());
        document.getElementById('btn-add-step')
            .addEventListener('click', () => {
                this.syncFromDom();
                this.form.steps.push(this.emptyStep());
                this.renderSteps();
            });
        document.getElementById('activity-image-input')
            .addEventListener('change', (e) =>
                this.onActivityImageChange(e));
        document.getElementById('btn-browse-activity-assets')
            .addEventListener('click', () =>
                this.openAssetPicker({ type: 'activity' }));
        document.getElementById('btn-close-asset-picker')
            .addEventListener('click', () => this.closeAssetPicker());
        document.getElementById('asset-search-form')
            .addEventListener('submit', (e) => {
                e.preventDefault();
                this.searchAssets(true);
            });
        document.getElementById('btn-load-more-assets')
            .addEventListener('click', () => this.searchAssets(false));
        document.getElementById('activityModal')
            .addEventListener('hidden.bs.modal', () =>
                this.closeAssetPicker());
    }

    async loadActivities() {
        try {
            this.activities = await api.get(
                this.collectiveId, 'activities'
            );
            this.renderList();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    renderList() {
        const container = document.getElementById('activities-list');
        if (!container) return;

        if (!this.activities.length) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <span class="empty-state-icon">
                            <i class="bi bi-stars"></i>
                        </span>
                        <h3>${t("no_activities")}</h3>
                        <p>${t("activities_empty_hint")}</p>
                    </div>
                </div>`;
            return;
        }

        container.innerHTML = this.activities.map(a => {
            const E = ActivitiesView.escape;
            const hue = ActivitiesView.colorHue(a.id || a.title);
            const media = a.image
                ? `<div class="activity-card-media">
                    <img src="${E(a.image)}" alt="${E(a.title)}">
                    ${this.attributionHtml(a.imageAttribution)}
                   </div>`
                : `<div class="activity-card-media activity-placeholder"
                    style="--asset-hue:${hue}">
                    <i class="bi bi-lightning-charge-fill"></i>
                   </div>`;
            const stepCount = Array.isArray(a.steps)
                ? a.steps.length : 0;
            const adminActions = this.isMember ? '' : `
                <button class="btn btn-sm btn-icon btn-outline-primary btn-edit"
                    data-id="${E(a.id)}" title="${t("edit")}">
                    <i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-icon btn-outline-danger btn-delete"
                    data-id="${E(a.id)}" title="${t("delete")}">
                    <i class="bi bi-trash"></i></button>`;
            return `
                <div class="col-12 col-md-6 col-lg-4">
                    <article class="card activity-card h-100">
                        ${media}
                        <div class="card-body d-flex flex-column">
                            <h3 class="card-title h5">${E(a.title)}</h3>
                            <p class="card-text text-muted flex-grow-1">
                                ${E((a.description || '').slice(0, 140))}</p>
                            <p class="activity-meta mb-3">
                                <i class="bi bi-list-check"></i>
                                ${stepCount} ${t("steps").toLowerCase()}</p>
                            <div class="d-flex gap-2 justify-content-between
                                align-items-center mt-auto">
                                <a href="/${this.collectiveId}/activities/${E(a.id)}"
                                    class="btn btn-success" data-link>
                                    <i class="bi bi-play-fill"></i>
                                    ${t("run_activity")}</a>
                                <div class="btn-group-actions">
                                    ${adminActions}
                                </div>
                            </div>
                        </div>
                    </article>
                </div>`;
        }).join('');

        container.querySelectorAll('.btn-edit').forEach(btn =>
            btn.addEventListener('click', (e) =>
                this.openModal(e.target.closest('button').dataset.id)));
        container.querySelectorAll('.btn-delete').forEach(btn =>
            btn.addEventListener('click', (e) =>
                this.deleteActivity(e.target.closest('button').dataset.id)));
    }

    // --- Modal / formulaire ---

    emptyStep() {
        return {
            title: '', description: '',
            images: []
        };
    }

    openModal(id = null) {
        const existing = id
            ? this.activities.find(a => a.id === id) : null;

        this.form = {
            id: existing?.id || null,
            title: existing?.title || '',
            image: existing?.image || null,
            imageAttribution: existing?.imageAttribution || null,
            description: existing?.description || '',
            duration: existing?.duration ?? null,
            durationUnit: existing?.durationUnit || 'minutes',
            noTimer: existing?.noTimer === true,
            trackHistory: existing ? existing.trackHistory !== false : true,
            assignedMembers: Array.isArray(existing?.assignedMembers)
                ? [...existing.assignedMembers] : [],
            steps: Array.isArray(existing?.steps) && existing.steps.length
                ? existing.steps.map(s => ({
                    title: s.title || '',
                    description: s.description || '',
                    images: Array.isArray(s.images)
                        ? s.images.map(im => ({
                            path: im.path,
                            caption: im.caption || '',
                            attribution: im.attribution || null
                        })) : []
                }))
                : [this.emptyStep()]
        };

        document.getElementById('activity-title').value = this.form.title;
        document.getElementById('activity-description').value =
            this.form.description;
        document.getElementById('activity-duration').value =
            this.form.duration ?? '';
        document.getElementById('activity-duration-unit').value =
            this.form.durationUnit;
        document.getElementById('activity-image-input').value = '';
        document.getElementById('activity-no-timer').checked =
            this.form.noTimer;
        document.getElementById('activity-track-history').checked =
            this.form.trackHistory;
        this.closeAssetPicker();
        this.renderActivityImage();
        this.renderMembers();
        this.renderSteps();
        this.modal.show();
    }

    renderActivityImage() {
        const E = ActivitiesView.escape;
        const el = document.getElementById('activity-image-preview');
        el.innerHTML = this.form.image
            ? `<figure class="asset-preview mb-0">
                <div class="position-relative">
                    <img src="${E(this.form.image)}"
                        alt="${E(this.form.title)}">
                    <button type="button"
                        class="btn btn-sm btn-danger btn-icon
                            position-absolute top-0 end-0 m-2"
                        id="btn-remove-activity-image"
                        aria-label="${t("delete")}">
                        <i class="bi bi-x-lg"></i></button>
                </div>
                ${this.attributionHtml(this.form.imageAttribution)}
               </figure>`
            : '';
        const rm = document.getElementById('btn-remove-activity-image');
        if (rm) rm.addEventListener('click', () => {
            this.form.image = null;
            this.form.imageAttribution = null;
            this.renderActivityImage();
        });
    }

    renderMembers() {
        const E = ActivitiesView.escape;
        const el = document.getElementById('activity-members');
        if (!this.members.length) {
            el.innerHTML = `<span class="text-muted small">—</span>`;
            return;
        }
        el.innerHTML = this.members.map(m => {
            const name = `${m.firstName || ''} ${m.lastName || ''}`.trim()
                || m.email || m.id;
            const checked = this.form.assignedMembers.includes(m.id)
                ? 'checked' : '';
            return `
                <div class="form-check">
                    <input class="form-check-input member-check"
                        type="checkbox" value="${E(m.id)}"
                        id="mbr-${E(m.id)}" ${checked}>
                    <label class="form-check-label" for="mbr-${E(m.id)}">
                        ${E(name)}</label>
                </div>`;
        }).join('');
    }

    renderSteps() {
        const E = ActivitiesView.escape;
        const container = document.getElementById('activity-steps');
        container.innerHTML = this.form.steps.map((s, i) => {
            const imagesHtml = s.images.map((im, j) => `
                <div class="step-image-row" data-step="${i}" data-img="${j}">
                    <img src="${E(im.path)}" alt="">
                    <div class="flex-grow-1">
                        <input type="text" class="form-control form-control-sm
                            step-img-caption" data-step="${i}" data-img="${j}"
                            placeholder="${t("caption")}"
                            value="${E(im.caption)}">
                        ${this.attributionHtml(im.attribution)}
                    </div>
                    <button type="button"
                        class="btn btn-sm btn-icon btn-outline-danger
                            btn-remove-img" data-step="${i}" data-img="${j}">
                        <i class="bi bi-x-lg"></i></button>
                </div>`).join('');

            return `
                <div class="card mb-2" data-step-card="${i}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="badge bg-secondary">
                                ${t("step")} ${i + 1}</span>
                            <button type="button"
                                class="btn btn-sm btn-outline-danger
                                    btn-remove-step" data-step="${i}">
                                <i class="bi bi-trash"></i></button>
                        </div>
                        <div class="mb-2">
                            <input type="text" class="form-control
                                form-control-sm step-title" data-step="${i}"
                                placeholder="${t("step_title")}"
                                value="${E(s.title)}">
                        </div>
                        <div class="mb-2">
                            <textarea class="form-control form-control-sm
                                step-desc" data-step="${i}" rows="2"
                                placeholder="${t("long_description")}">${E(s.description)}</textarea>
                        </div>
                        <div class="step-images">${imagesHtml}</div>
                        <div class="asset-actions mt-2">
                            <label class="btn btn-sm btn-outline-secondary">
                                <i class="bi bi-upload"></i>
                                ${t("upload_image")}
                                <input type="file" accept="image/*" hidden
                                    class="step-img-input" data-step="${i}">
                            </label>
                            <button type="button"
                                class="btn btn-sm btn-outline-primary
                                    btn-browse-step-assets" data-step="${i}">
                                <i class="bi bi-images"></i>
                                ${t("image_library")}
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        container.querySelectorAll('.btn-remove-step').forEach(btn =>
            btn.addEventListener('click', (e) => {
                this.syncFromDom();
                const idx = Number(e.target.closest('button').dataset.step);
                this.form.steps.splice(idx, 1);
                if (!this.form.steps.length) {
                    this.form.steps.push(this.emptyStep());
                }
                this.renderSteps();
            }));

        container.querySelectorAll('.btn-remove-img').forEach(btn =>
            btn.addEventListener('click', (e) => {
                this.syncFromDom();
                const b = e.target.closest('button');
                const si = Number(b.dataset.step);
                const ii = Number(b.dataset.img);
                this.form.steps[si].images.splice(ii, 1);
                this.renderSteps();
            }));

        container.querySelectorAll('.step-img-input').forEach(input =>
            input.addEventListener('change', (e) =>
                this.onStepImageChange(e)));
        container.querySelectorAll('.btn-browse-step-assets').forEach(btn =>
            btn.addEventListener('click', (e) => {
                const step = Number(e.target.closest('button').dataset.step);
                this.openAssetPicker({ type: 'step', step });
            }));
    }

    openAssetPicker(target) {
        this.syncFromDom();
        this.assetTarget = target;
        this.assetResults = [];
        this.assetSearchPage = 1;
        this.assetHasMore = false;

        const panel = document.getElementById('asset-picker-panel');
        const form = document.getElementById('activity-form');
        const footer = document.getElementById('activity-modal-footer');
        if (!panel || !form) return;
        panel.classList.remove('d-none');
        form.classList.add('d-none');
        footer?.classList.add('d-none');

        const stepTitle = target.type === 'step'
            ? this.form.steps[target.step]?.title : '';
        const input = document.getElementById('asset-search-input');
        input.value = (stepTitle || this.form.title || '').trim();
        this.renderAssetResults();
        if (input.value.length >= 2) {
            this.searchAssets(true);
        } else {
            input.focus();
        }
    }

    closeAssetPicker() {
        document.getElementById('asset-picker-panel')
            ?.classList.add('d-none');
        document.getElementById('activity-form')
            ?.classList.remove('d-none');
        document.getElementById('activity-modal-footer')
            ?.classList.remove('d-none');
        this.assetTarget = null;
    }

    async searchAssets(reset) {
        const input = document.getElementById('asset-search-input');
        const query = input?.value.trim() || '';
        const status = document.getElementById('asset-search-status');
        if (query.length < 2) {
            status.textContent = t('asset_search_min');
            input?.focus();
            return;
        }

        if (reset) {
            this.assetResults = [];
            this.assetSearchPage = 1;
            this.renderAssetResults(true);
        } else {
            this.assetSearchPage += 1;
        }

        const searchButton = document.getElementById('btn-search-assets');
        const moreButton = document.getElementById('btn-load-more-assets');
        searchButton.disabled = true;
        moreButton.disabled = true;
        status.innerHTML = `<span class="spinner-border spinner-border-sm"
            aria-hidden="true"></span> ${t('loading')}`;

        try {
            const result = await api.searchAssets(this.collectiveId, {
                query,
                page: this.assetSearchPage,
                lang: i18n.lang
            });
            this.assetResults.push(...result.items);
            this.assetHasMore = result.hasMore;
            this.renderAssetResults();
            status.textContent = this.assetResults.length
                ? `${this.assetResults.length} ${t('images_found')}`
                : t('no_images_found');
        } catch (error) {
            if (!reset) this.assetSearchPage -= 1;
            status.textContent = `${t('asset_search_error')} ${error.message}`;
            status.classList.add('text-danger');
            this.renderAssetResults();
        } finally {
            searchButton.disabled = false;
            moreButton.disabled = false;
        }
    }

    renderAssetResults(loading = false) {
        const E = ActivitiesView.escape;
        const container = document.getElementById('asset-search-results');
        const moreButton = document.getElementById('btn-load-more-assets');
        const status = document.getElementById('asset-search-status');
        if (!container || !moreButton) return;
        status?.classList.remove('text-danger');

        if (loading) {
            container.innerHTML = Array.from({ length: 6 }, () => `
                <div class="asset-result-card asset-skeleton">
                    <span></span><small></small>
                </div>`).join('');
            moreButton.classList.add('d-none');
            return;
        }

        container.innerHTML = this.assetResults.map((asset, index) => `
            <button type="button" class="asset-result-card"
                data-asset-index="${index}"
                title="${t('use_image')}">
                <span class="asset-result-image">
                    <img src="${E(asset.thumbnailUrl)}" loading="lazy"
                        alt="${E(asset.title)}">
                    <span class="asset-use-label">
                        <i class="bi bi-check2"></i> ${t('use_image')}
                    </span>
                </span>
                <span class="asset-result-info">
                    <strong>${E(asset.title)}</strong>
                    <small>${E(asset.author || asset.provider)}
                        ${asset.license ? ` · ${E(asset.license)}` : ''}</small>
                </span>
            </button>`).join('');

        container.querySelectorAll('.asset-result-card').forEach(button =>
            button.addEventListener('click', () =>
                this.selectAsset(Number(button.dataset.assetIndex), button)));
        moreButton.classList.toggle(
            'd-none', !this.assetHasMore || !this.assetResults.length
        );
    }

    async selectAsset(index, button) {
        const asset = this.assetResults[index];
        const target = this.assetTarget;
        if (!asset || !target) return;

        button.disabled = true;
        const label = button.querySelector('.asset-use-label');
        if (label) {
            label.innerHTML = `<span class="spinner-border spinner-border-sm"
                aria-hidden="true"></span> ${t('asset_importing')}`;
        }

        try {
            const imported = await api.importAsset(
                this.collectiveId, asset
            );
            if (target.type === 'activity') {
                this.form.image = imported.path;
                this.form.imageAttribution = imported.attribution;
            } else if (this.form.steps[target.step]) {
                this.form.steps[target.step].images.push({
                    path: imported.path,
                    caption: '',
                    attribution: imported.attribution
                });
            }
            this.closeAssetPicker();
            this.renderActivityImage();
            this.renderSteps();
        } catch (error) {
            button.disabled = false;
            const status = document.getElementById('asset-search-status');
            status.textContent = `${t('error')}: ${error.message}`;
            status.classList.add('text-danger');
            if (label) {
                label.innerHTML = `<i class="bi bi-check2"></i>
                    ${t('use_image')}`;
            }
        }
    }

    /** Recopie les valeurs saisies du DOM vers this.form avant un re-rendu */
    syncFromDom() {
        this.form.title =
            document.getElementById('activity-title').value;
        this.form.description =
            document.getElementById('activity-description').value;
        const durVal = document.getElementById('activity-duration').value;
        this.form.duration = durVal ? Number(durVal) : null;
        this.form.durationUnit =
            document.getElementById('activity-duration-unit').value;
        this.form.assignedMembers = Array.from(
            document.querySelectorAll('.member-check:checked')
        ).map(cb => cb.value);

        document.querySelectorAll('.step-title').forEach(el => {
            const i = Number(el.dataset.step);
            if (this.form.steps[i]) this.form.steps[i].title = el.value;
        });
        document.querySelectorAll('.step-desc').forEach(el => {
            const i = Number(el.dataset.step);
            if (this.form.steps[i]) this.form.steps[i].description = el.value;
        });
        document.querySelectorAll('.step-img-caption').forEach(el => {
            const si = Number(el.dataset.step);
            const ii = Number(el.dataset.img);
            if (this.form.steps[si]?.images[ii]) {
                this.form.steps[si].images[ii].caption = el.value;
            }
        });
    }

    async onActivityImageChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const res = await api.uploadFile({
                collectiveId: this.collectiveId,
                endpoint: 'activity-images', file
            });
            this.form.image = res.path;
            this.form.imageAttribution = null;
            e.target.value = '';
            this.renderActivityImage();
        } catch (err) {
            alert(t("error") + ': ' + err.message);
        }
    }

    async onStepImageChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const stepIndex = Number(e.target.dataset.step);
        try {
            this.syncFromDom();
            const res = await api.uploadFile({
                collectiveId: this.collectiveId,
                endpoint: 'activity-images', file
            });
            this.form.steps[stepIndex].images.push({
                path: res.path, caption: '', attribution: null
            });
            this.renderSteps();
        } catch (err) {
            alert(t("error") + ': ' + err.message);
        }
    }

    async save() {
        const form = document.getElementById('activity-form');
        if (!form.reportValidity()) return;
        this.syncFromDom();

        const data = {
            title: this.form.title,
            image: this.form.image,
            imageAttribution: this.form.imageAttribution,
            description: this.form.description,
            duration: this.form.duration,
            durationUnit: this.form.durationUnit,
            noTimer: document.getElementById('activity-no-timer').checked,
            trackHistory: document.getElementById(
                'activity-track-history').checked,
            assignedMembers: this.form.assignedMembers,
            steps: this.form.steps
                .filter(s => s.title || s.description || s.images.length)
        };

        try {
            if (this.form.id) {
                await api.update(
                    this.collectiveId, 'activities', this.form.id, data
                );
            } else {
                await api.create(this.collectiveId, 'activities', data);
            }
            this.modal.hide();
            await this.loadActivities();
        } catch (error) {
            alert(t("error_save") + ': ' + error.message);
        }
    }

    async deleteActivity(id) {
        if (!confirm(t("confirm_delete"))) return;
        try {
            await api.delete(this.collectiveId, 'activities', id);
            await this.loadActivities();
        } catch (error) {
            alert(t("error_delete") + ': ' + error.message);
        }
    }
}
