class ActivitiesView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("activities") + " - " + t("brand"));
        this.activities = [];
        this.members = [];
        // État du formulaire (structure dynamique : étapes + images)
        this.form = null;
    }

    static escape(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
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
                                    <input type="file" accept="image/*"
                                        class="form-control"
                                        id="activity-image-input">
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
                        <div class="modal-footer">
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
                <p class="text-muted" data-i18n="no_activities">
                    ${t("no_activities")}</p>`;
            return;
        }

        container.innerHTML = this.activities.map(a => {
            const E = ActivitiesView.escape;
            const img = a.image
                ? `<img src="${E(a.image)}" class="card-img-top"
                    style="height:160px;object-fit:cover;"
                    alt="${E(a.title)}">`
                : '';
            const stepCount = Array.isArray(a.steps)
                ? a.steps.length : 0;
            const adminActions = this.isMember ? '' : `
                <button class="btn btn-sm btn-outline-primary btn-edit"
                    data-id="${E(a.id)}" title="${t("edit")}">
                    <i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete"
                    data-id="${E(a.id)}" title="${t("delete")}">
                    <i class="bi bi-trash"></i></button>`;
            return `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card h-100">
                        ${img}
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${E(a.title)}</h5>
                            <p class="card-text small text-muted flex-grow-1">
                                ${E((a.description || '').slice(0, 120))}</p>
                            <p class="small text-muted mb-2">
                                <i class="bi bi-list-check"></i>
                                ${stepCount} ${t("steps").toLowerCase()}</p>
                            <div class="d-flex gap-2 justify-content-between
                                align-items-center mt-auto">
                                <a href="/${this.collectiveId}/activities/${E(a.id)}"
                                    class="btn btn-sm btn-success" data-link>
                                    <i class="bi bi-play-fill"></i>
                                    ${t("run_activity")}</a>
                                <div class="btn-group-actions">
                                    ${adminActions}
                                </div>
                            </div>
                        </div>
                    </div>
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
            description: existing?.description || '',
            duration: existing?.duration ?? null,
            durationUnit: existing?.durationUnit || 'minutes',
            trackHistory: existing ? existing.trackHistory !== false : true,
            assignedMembers: Array.isArray(existing?.assignedMembers)
                ? [...existing.assignedMembers] : [],
            steps: Array.isArray(existing?.steps) && existing.steps.length
                ? existing.steps.map(s => ({
                    title: s.title || '',
                    description: s.description || '',
                    images: Array.isArray(s.images)
                        ? s.images.map(im => ({
                            path: im.path, caption: im.caption || ''
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
        document.getElementById('activity-track-history').checked =
            this.form.trackHistory;
        this.renderActivityImage();
        this.renderMembers();
        this.renderSteps();
        this.modal.show();
    }

    renderActivityImage() {
        const E = ActivitiesView.escape;
        const el = document.getElementById('activity-image-preview');
        el.innerHTML = this.form.image
            ? `<div class="position-relative d-inline-block">
                <img src="${E(this.form.image)}"
                    style="max-height:120px;border-radius:6px;">
                <button type="button"
                    class="btn btn-sm btn-danger position-absolute top-0 end-0
                        m-1 py-0 px-1" id="btn-remove-activity-image">
                    <i class="bi bi-x"></i></button>
               </div>`
            : '';
        const rm = document.getElementById('btn-remove-activity-image');
        if (rm) rm.addEventListener('click', () => {
            this.form.image = null;
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
                <div class="d-flex align-items-center gap-2 mb-2"
                    data-step="${i}" data-img="${j}">
                    <img src="${E(im.path)}"
                        style="height:48px;width:48px;object-fit:cover;
                            border-radius:4px;">
                    <input type="text" class="form-control form-control-sm
                        step-img-caption" data-step="${i}" data-img="${j}"
                        placeholder="${t("caption")}"
                        value="${E(im.caption)}">
                    <button type="button"
                        class="btn btn-sm btn-outline-danger btn-remove-img"
                        data-step="${i}" data-img="${j}">
                        <i class="bi bi-x"></i></button>
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
                        <label class="btn btn-sm btn-outline-secondary mt-1">
                            <i class="bi bi-image"></i> ${t("add_image")}
                            <input type="file" accept="image/*" hidden
                                class="step-img-input" data-step="${i}">
                        </label>
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
                path: res.path, caption: ''
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
            description: this.form.description,
            duration: this.form.duration,
            durationUnit: this.form.durationUnit,
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
