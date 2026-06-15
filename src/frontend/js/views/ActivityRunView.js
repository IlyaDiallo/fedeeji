class ActivityRunView extends AbstractView {
    constructor(params) {
        super(params);
        this.activityId = params.activityId;
        this.activity = null;
        this.done = {};           // { stepIndex: true }
        this.timer = {
            elapsed: 0, running: false, intervalId: null
        };
        this.setTitle(t("activity") + " - " + t("brand"));
    }

    static escape(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    formatDuration(duration, unit) {
        if (!duration) return '';
        const label = t(unit || 'minutes', duration);
        return `${duration} ${label.toLowerCase()}`;
    }

    formatTime(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const pad = n => String(n).padStart(2, '0');
        return h > 0
            ? `${pad(h)}:${pad(m)}:${pad(s)}`
            : `${pad(m)}:${pad(s)}`;
    }

    async getHtml() {
        return `<div id="activity-run"></div>`;
    }

    async init() {
        // Stoppe un éventuel timer laissé par une vue précédente
        if (window.__activityTimerId) {
            clearInterval(window.__activityTimerId);
            window.__activityTimerId = null;
        }

        try {
            this.activity = await api.getById(
                this.collectiveId, 'activities', this.activityId
            );
        } catch (error) {
            document.getElementById('activity-run').innerHTML = `
                <div class="alert alert-danger">${error.message}</div>
                <a href="/${this.collectiveId}/activities"
                    class="btn btn-secondary" data-link>
                    <i class="bi bi-arrow-left"></i> ${t("back")}</a>`;
            return;
        }

        this.render();
        this.attachEvents();
    }

    render() {
        const E = ActivityRunView.escape;
        const a = this.activity;
        const steps = Array.isArray(a.steps) ? a.steps : [];

        const image = a.image
            ? `<img src="${E(a.image)}" class="img-fluid rounded mb-3"
                style="max-height:280px;object-fit:cover;width:100%;"
                alt="${E(a.title)}">`
            : '';

        const stepsHtml = steps.map((s, i) => {
            const durBadge = s.duration
                ? `<span class="badge bg-info text-dark ms-2">
                    <i class="bi bi-clock"></i>
                    ${this.formatDuration(s.duration, s.durationUnit)}</span>`
                : '';
            const imgs = Array.isArray(s.images) ? s.images : [];
            const imagesHtml = imgs.length ? `
                <div class="row g-2 mt-2">
                    ${imgs.map(im => `
                        <div class="col-6 col-md-4">
                            <figure class="mb-0">
                                <img src="${E(im.path)}"
                                    class="img-fluid rounded"
                                    style="width:100%;object-fit:cover;">
                                ${im.caption ? `<figcaption
                                    class="small text-muted text-center mt-1">
                                    ${E(im.caption)}</figcaption>` : ''}
                            </figure>
                        </div>`).join('')}
                </div>` : '';

            return `
                <div class="accordion-item">
                    <div class="accordion-header d-flex align-items-center">
                        <div class="form-check ps-3 pe-1">
                            <input class="form-check-input step-done"
                                type="checkbox" data-i="${i}"
                                id="step-done-${i}">
                        </div>
                        <button class="accordion-button collapsed flex-grow-1"
                            type="button" data-bs-toggle="collapse"
                            data-bs-target="#step-body-${i}">
                            <span class="step-label" data-i="${i}">
                                <strong>${i + 1}.</strong> ${E(s.title)}</span>
                            ${durBadge}
                        </button>
                    </div>
                    <div id="step-body-${i}"
                        class="accordion-collapse collapse">
                        <div class="accordion-body">
                            ${s.description ? `<p style="white-space:pre-wrap;">
                                ${E(s.description)}</p>` : ''}
                            ${imagesHtml}
                        </div>
                    </div>
                </div>`;
        }).join('');

        document.getElementById('activity-run').innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <h2 class="mb-0">${E(a.title)}</h2>
                <a href="/${this.collectiveId}/activities"
                    class="btn btn-sm btn-outline-secondary" data-link>
                    <i class="bi bi-arrow-left"></i> ${t("back")}</a>
            </div>
            ${image}
            ${a.description ? `<p style="white-space:pre-wrap;">
                ${E(a.description)}</p>` : ''}

            <div class="card mb-3">
                <div class="card-body d-flex align-items-center
                    justify-content-between flex-wrap gap-2">
                    <div class="fs-3 fw-bold font-monospace" id="timer-display">
                        ${this.formatTime(this.timer.elapsed)}</div>
                    <div class="btn-group">
                        <button class="btn btn-success" id="timer-start">
                            <i class="bi bi-play-fill"></i>
                            ${t("start_timer")}</button>
                        <button class="btn btn-warning d-none" id="timer-pause">
                            <i class="bi bi-pause-fill"></i>
                            ${t("pause")}</button>
                        <button class="btn btn-outline-secondary"
                            id="timer-reset">
                            <i class="bi bi-arrow-counterclockwise"></i>
                            ${t("reset")}</button>
                    </div>
                </div>
            </div>

            <div class="progress mb-3" style="height:20px;">
                <div class="progress-bar" id="activity-progress"
                    role="progressbar" style="width:0%;">0%</div>
            </div>

            <div class="accordion" id="activity-steps-acc">
                ${stepsHtml || `<p class="text-muted">${t("no_steps")}</p>`}
            </div>
        `;

        this.updateProgress();
    }

    attachEvents() {
        document.querySelectorAll('.step-done').forEach(cb =>
            cb.addEventListener('change', (e) => {
                const i = e.target.dataset.i;
                this.done[i] = e.target.checked;
                const label = document.querySelector(
                    `.step-label[data-i="${i}"]`
                );
                if (label) {
                    label.style.textDecoration =
                        e.target.checked ? 'line-through' : 'none';
                    label.classList.toggle('text-muted', e.target.checked);
                }
                this.updateProgress();
            }));

        document.getElementById('timer-start')
            .addEventListener('click', () => this.startTimer());
        document.getElementById('timer-pause')
            .addEventListener('click', () => this.pauseTimer());
        document.getElementById('timer-reset')
            .addEventListener('click', () => this.resetTimer());
    }

    updateProgress() {
        const steps = Array.isArray(this.activity.steps)
            ? this.activity.steps : [];
        const total = steps.length || 1;
        const doneCount = Object.values(this.done).filter(Boolean).length;
        const pct = Math.round((doneCount / total) * 100);
        const bar = document.getElementById('activity-progress');
        if (bar) {
            bar.style.width = `${pct}%`;
            bar.textContent = `${doneCount}/${steps.length} (${pct}%)`;
            bar.classList.toggle('bg-success', pct === 100);
        }
    }

    startTimer() {
        if (this.timer.running) return;
        this.timer.running = true;
        document.getElementById('timer-start').classList.add('d-none');
        document.getElementById('timer-pause').classList.remove('d-none');
        window.__activityTimerId = setInterval(() => {
            this.timer.elapsed += 1;
            const disp = document.getElementById('timer-display');
            if (disp) disp.textContent = this.formatTime(this.timer.elapsed);
        }, 1000);
    }

    pauseTimer() {
        this.timer.running = false;
        if (window.__activityTimerId) {
            clearInterval(window.__activityTimerId);
            window.__activityTimerId = null;
        }
        document.getElementById('timer-pause').classList.add('d-none');
        document.getElementById('timer-start').classList.remove('d-none');
    }

    resetTimer() {
        this.pauseTimer();
        this.timer.elapsed = 0;
        const disp = document.getElementById('timer-display');
        if (disp) disp.textContent = this.formatTime(0);
    }
}
