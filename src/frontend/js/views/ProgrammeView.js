/**
 * Vue Programme — orchestrateur.
 * Délègue la logique métier et le rendu aux modules extraits :
 *   - ActionOccurrenceResolver (statique) : résolution des occurrences
 *   - ProgrammeRenderers (statique) : rendu HTML liste/calendrier/historique
 *   - ActionFormManager (instance) : modal CRUD actions
 *   - LogFormManager (instance) : modal logs (done/note/consultation)
 */
class ProgrammeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("programme") + " - " + t("brand"));
        this.events = [];
        this.actions = [];
        this.actionLogs = [];
        this.members = [];
        this.viewMode = 'list';
        this.currentDate = new Date();
        this.activeTab = 'all';
    }

    async getHtml() {
        const addBtn = this.isMember ? '' : `
            <button class="btn btn-primary" id="btn-add-action"
                title="${t("add_action") || "Ajouter une action"}"
                aria-label="${t("add_action") || "Ajouter une action"}">
                <i class="bi bi-plus-circle"></i>
                <span class="d-none d-md-inline">
                    ${t("add_action") || "Ajouter une action"}</span>
            </button>`;

        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="programme">${t("programme")}</h2>
                <div>${addBtn}</div>
            </div>

            <div class="programme-toolbar d-flex justify-content-between
                align-items-center mb-3">
                <ul class="nav nav-tabs mb-0 border-bottom-0" id="programme-tabs">
                    <li class="nav-item">
                        <a class="nav-link active" href="#"
                            data-tab="all">${t("all")}</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#"
                            data-tab="events">${t("events")}</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#"
                            data-tab="actions">${t("actions_label")}</a>
                    </li>
                </ul>

                <div class="btn-group programme-view-switcher" role="group">
                    <input type="radio" class="btn-check" name="view-mode"
                        id="view-list" value="list" autocomplete="off" checked>
                    <label class="btn btn-outline-secondary btn-sm btn-icon"
                        for="view-list" title="Liste">
                        <i class="bi bi-list-ul"></i></label>

                    <input type="radio" class="btn-check" name="view-mode"
                        id="view-week" value="week" autocomplete="off">
                    <label class="btn btn-outline-secondary btn-sm btn-icon"
                        for="view-week" title="Semaine">
                        <i class="bi bi-calendar-week"></i></label>

                    <input type="radio" class="btn-check" name="view-mode"
                        id="view-month" value="month" autocomplete="off">
                    <label class="btn btn-outline-secondary btn-sm btn-icon"
                        for="view-month" title="Mois">
                        <i class="bi bi-calendar-month"></i></label>
                </div>
            </div>

            <div id="calendar-nav"
                class="d-flex justify-content-between align-items-center mb-3 d-none">
                <button class="btn btn-outline-secondary btn-sm btn-icon"
                    id="btn-prev-cal" title="${t("previous_period")}"
                    aria-label="${t("previous_period")}">
                    <i class="bi bi-chevron-left"></i></button>
                <h5 id="calendar-label" class="mb-0"></h5>
                <button class="btn btn-outline-secondary btn-sm btn-icon"
                    id="btn-next-cal" title="${t("next_period")}"
                    aria-label="${t("next_period")}">
                    <i class="bi bi-chevron-right"></i></button>
            </div>

            <div id="programme-list" class="list-group border-0"></div>
            <div id="programme-calendar" class="d-none"></div>

            <!-- Modal action -->
            <div class="modal fade" id="actionModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="actionModalTitle">
                                ${t("schedule_action_title")}</h5>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${IllustrationPicker.panelHtml()}
                            <form id="action-form">
                                <input type="hidden" id="action-id">
                                <div class="mb-3" id="action-type-container">
                                    <label class="form-label fw-bold">
                                        Quand ?</label>
                                    <div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input"
                                                type="radio"
                                                name="action-executionType"
                                                id="exec-type-scheduled"
                                                value="scheduled" checked>
                                            <label class="form-check-label"
                                                for="exec-type-scheduled"
                                                data-i18n="scheduled">
                                                ${t("scheduled") || "Programmée"}
                                            </label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input"
                                                type="radio"
                                                name="action-executionType"
                                                id="exec-type-now" value="now">
                                            <label class="form-check-label"
                                                for="exec-type-now"
                                                data-i18n="now">
                                                ${t("now") || "Maintenant"}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3"
                                    id="action-template-container">
                                    <label class="form-label">
                                        ${t("template")}</label>
                                    <select class="form-select"
                                        id="action-template-select"></select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">
                                        ${t("name")}</label>
                                    <input type="text" class="form-control"
                                        id="action-name" required>
                                </div>
                                ${IllustrationPicker.fieldHtml()}
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="intermediate_states">
                                        ${t("intermediate_states")
                                            || "États intermédiaires"}</label>
                                    <input type="text" class="form-control"
                                        id="action-states"
                                        placeholder="ex: En cours, Vérifié">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">
                                        Description</label>
                                    <textarea class="form-control"
                                        id="action-description"></textarea>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label"
                                            id="action-date-label">
                                            ${t("date")}</label>
                                        <input type="date" class="form-control"
                                            id="action-date" required>
                                    </div>
                                    <div class="col-md-6 mb-3"
                                        id="action-recurrenceEndDate-container"
                                        style="display:none;">
                                        <label class="form-label">
                                            ${t("recurrence_end_date")}</label>
                                        <input type="date" class="form-control"
                                            id="action-recurrenceEndDate">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input"
                                            type="radio" name="action-allDay"
                                            id="action-allDay-yes"
                                            value="yes" checked>
                                        <label class="form-check-label"
                                            for="action-allDay-yes">
                                            ${t("all_day")}</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input"
                                            type="radio" name="action-allDay"
                                            id="action-allDay-no" value="no">
                                        <label class="form-check-label"
                                            for="action-allDay-no">
                                            ${t("time_and_duration")}</label>
                                    </div>
                                </div>
                                <div id="action-time-duration"
                                    style="display:none;">
                                    <div class="mb-3">
                                        <label class="form-label">
                                            ${t("time")}</label>
                                        <input type="time" class="form-control"
                                            id="action-time">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">
                                            ${t("duration")}</label>
                                        <div class="input-group">
                                            <input type="number"
                                                class="form-control"
                                                id="action-duration" min="1">
                                            <select class="form-select"
                                                id="action-durationUnit"
                                                style="max-width:140px">
                                                <option value="minutes"
                                                    ${ActionUtils.DEFAULT_DURATION_UNIT === 'minutes' ? 'selected' : ''}>
                                                    ${t("minutes")}</option>
                                                <option value="hours"
                                                    ${ActionUtils.DEFAULT_DURATION_UNIT === 'hours' ? 'selected' : ''}>
                                                    ${t("hours")}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="mb-3"
                                    id="action-recurrence-main-container">
                                    <label class="form-label"
                                        data-i18n="recurrence">
                                        ${t("recurrence")}</label>
                                    <div class="input-group">
                                        <span class="input-group-text"
                                            id="action-recurrence-label">
                                            ${t("every")}</span>
                                        <input type="number"
                                            class="form-control"
                                            id="action-recurrenceInterval"
                                            min="1" value="1"
                                            style="max-width: 80px;">
                                        <select class="form-select"
                                            id="action-recurrence">
                                            <option value="none">
                                                ${t("recurrence_none")}</option>
                                            <option value="daily">
                                                ${t("days")}</option>
                                            <option value="weekly">
                                                ${t("weeks")}</option>
                                            <option value="monthly">
                                                ${t("months_unit")}</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="mb-3"
                                    id="action-recurrence-days-container"
                                    style="display:none;">
                                    <label class="form-label">
                                        ${t("recurrence_days")}</label>
                                    <div>
                                        ${[1,2,3,4,5,6,0].map(d => `
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input
                                                action-recurrence-day"
                                                type="checkbox"
                                                id="action-rec-day-${d}"
                                                value="${d}">
                                            <label class="form-check-label"
                                                for="action-rec-day-${d}">
                                                ${t("day_" + d)}</label>
                                        </div>`).join('')}
                                    </div>
                                </div>
                                <div class="mb-3"
                                    id="action-monthly-type-container"
                                    style="display:none;">
                                    <label class="form-label">
                                        ${t("monthly_type")}</label>
                                    <select class="form-select"
                                        id="action-monthlyType">
                                        <option value="date">
                                            ${t("monthly_type_date")}</option>
                                        <option value="first_day">
                                            ${t("monthly_type_first")}</option>
                                        <option value="last_day">
                                            ${t("monthly_type_last")}</option>
                                        <option value="nth_weekday">
                                            ${t("monthly_type_weekday")}</option>
                                    </select>
                                </div>

                                <div class="mb-3"
                                    id="action-window-main-container">
                                    <label class="form-label"
                                        data-i18n="window_days">
                                        ${t("window_days")}</label>
                                    <div class="input-group">
                                        <input type="number"
                                            class="form-control"
                                            id="action-windowDays"
                                            min="0" value="0">
                                        <span class="input-group-text">
                                            ${t("days_before")}</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer" id="action-modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal"
                                data-i18n="cancel">${t("cancel")}</button>
                            <button type="button"
                                class="btn btn-primary"
                                id="btn-save-action"
                                data-i18n="save">${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal log (Fait !) -->
            <div class="modal fade" id="logModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header action-detail-header">
                            <div class="action-detail-identity">
                                <img id="log-action-illustration"
                                    class="action-detail-illustration" alt="">
                                <div class="action-detail-copy">
                                    <h5 class="modal-title" id="logModalTitle">
                                        ${t("mark_done")}</h5>
                                    <div class="action-detail-name"
                                        id="log-action-name"></div>
                                </div>
                            </div>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="log-form">
                                <input type="hidden" id="log-id">
                                <input type="hidden" id="log-actionId">
                                <input type="hidden" id="log-type" value="done">
                                <input type="hidden" id="log-occurrence-date">
                                <div class="mb-3" id="log-state-container"
                                    style="display:none;">
                                    <label class="form-label"
                                        data-i18n="target_state">
                                        ${t("target_state") || "État cible"}
                                    </label>
                                    <select class="form-select"
                                        id="log-state"></select>
                                </div>
                                <div id="log-window-info" class="d-none"></div>
                                <div id="log-existing-notes"
                                    class="mb-3 d-none"></div>
                                <div class="mb-3">
                                    <label class="form-label">
                                        ${t("date")}</label>
                                    <input type="date" class="form-control"
                                        id="log-date" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">
                                            ${t("time")}</label>
                                        <input type="time" class="form-control"
                                            id="log-time">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">
                                            ${t("duration")}</label>
                                        <div class="input-group">
                                            <input type="number"
                                                class="form-control"
                                                id="log-duration" min="1">
                                            <select class="form-select"
                                                id="log-durationUnit"
                                                style="max-width:120px">
                                                <option value="minutes"
                                                    ${ActionUtils.DEFAULT_DURATION_UNIT === 'minutes' ? 'selected' : ''}>
                                                    ${t("minutes")}</option>
                                                <option value="hours"
                                                    ${ActionUtils.DEFAULT_DURATION_UNIT === 'hours' ? 'selected' : ''}>
                                                    ${t("hours")}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">
                                        ${t("notes")}</label>
                                    <textarea class="form-control"
                                        id="log-notes" rows="2"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-danger d-none"
                                id="btn-delete-log">${t("delete")}</button>
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal">${t("cancel")}</button>
                            <button type="button"
                                class="btn btn-success"
                                id="btn-save-log">${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal historique -->
            <div class="modal fade" id="historyModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header action-detail-header">
                            <div class="action-detail-identity">
                                <img id="history-action-illustration"
                                    class="action-detail-illustration" alt="">
                                <div class="action-detail-copy">
                                    <h5 class="modal-title" id="historyModalTitle">
                                        ${t("history")}</h5>
                                    <div class="action-detail-name"
                                        id="history-action-name"></div>
                                </div>
                            </div>
                            <button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="history-body"></div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal">${t("close")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Chargement des données ---

    async loadData() {
        try {
            const [events, actions, actionLogs] = await Promise.all([
                api.get(this.collectiveId, 'events'),
                api.get(this.collectiveId, 'actions'),
                api.get(this.collectiveId, 'action-logs')
            ]);
            this.events = events || [];
            this.actions = actions || [];
            this.actionLogs = actionLogs || [];
            if (!this.isMember) {
                this.members = await api.get(this.collectiveId, 'members');
            }
        } catch (error) {
            this.events = [];
            this.actions = [];
            this.actionLogs = [];
            this.members = [];
        }
        this.renderContent();
    }

    // --- Routage liste / calendrier ---

    renderContent(filter = 'all') {
        const activeTab = document.querySelector(
            '#programme-tabs a.active'
        );
        const currentFilter = activeTab
            ? activeTab.dataset.tab : filter;

        if (this.viewMode === 'list') {
            document.getElementById('programme-list')
                .classList.remove('d-none');
            document.getElementById('programme-calendar')
                .classList.add('d-none');
            document.getElementById('calendar-nav')
                .classList.add('d-none');
            this.renderList(currentFilter);
        } else {
            document.getElementById('programme-list')
                .classList.add('d-none');
            document.getElementById('programme-calendar')
                .classList.remove('d-none');
            document.getElementById('calendar-nav')
                .classList.remove('d-none');
            this.renderCalendar(currentFilter);
        }
    }

    // --- Vue liste ---

    renderList(filter = 'all') {
        const container = document.getElementById('programme-list');
        container.innerHTML = '';

        const items = [];
        const now = new Date();
        const todayStr = RecurrenceUtils.formatDateStr(now);

        // Événements
        if (filter === 'all' || filter === 'events') {
            this.events.forEach(event => {
                const occurrences = window.RecurrenceUtils
                    ? RecurrenceUtils.generateOccurrences({
                        event, startDate: now
                    }) : [event];
                const future = (occurrences || [])
                    .filter(o => o.occurrenceDate >= todayStr);
                if (future.length > 0) {
                    items.push({
                        type: 'event',
                        data: event,
                        nextDate: future[0].occurrenceDate,
                        occurrence: future[0]
                    });
                }
            });
        }

        // Actions — résolution via ActionOccurrenceResolver
        if (filter === 'all' || filter === 'actions') {
            this.actions.forEach(rawAction => {
                const action = ActionUtils.normalize(rawAction, todayStr);
                const item = ActionOccurrenceResolver.resolveNextOccurrence({
                    action,
                    actionLogs: this.actionLogs,
                    todayStr
                });
                if (item) items.push(item);
            });
        }

        items.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
        this.lastRenderedItems = items;

        if (items.length === 0) {
            container.innerHTML = `<p class="text-muted">`
                + `${t("no_programme_items")}</p>`;
            return;
        }

        const getMemberName = id => this.getMemberName(id);
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'programme-list-item list-group-item border rounded mb-2';
            div.innerHTML = item.type === 'event'
                ? ProgrammeRenderers.renderEventItem({
                    item, locale: this.locale,
                    collectiveId: this.collectiveId
                })
                : ProgrammeRenderers.renderActionItem({
                    item, locale: this.locale,
                    isMember: this.isMember, getMemberName,
                    collectiveId: this.collectiveId
                });
            container.appendChild(div);
        });

        this.bindItemEvents();
    }

    // --- Vue calendrier ---

    renderCalendar(filter = 'all') {
        const container = document.getElementById('programme-calendar');
        container.innerHTML = '';

        const { startCal, endCal, month } = this._computeCalendarRange();
        const items = this._collectCalendarItems({
            filter, startCal, endCal
        });

        container.innerHTML = ProgrammeRenderers.renderCalendarGrid({
            items, startCal, endCal,
            viewMode: this.viewMode,
            month,
            collectiveId: this.collectiveId
        });
        ProgrammeRenderers.ensureCalendarStyles();
        this._bindCalendarEvents(container);
    }

    // --- Historique ---

    openHistoryModal(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        document.getElementById('historyModalTitle').textContent = t("history");
        document.getElementById('history-action-name').textContent =
            action?.name || t("action_label");
        document.getElementById('history-action-illustration').src =
            ProgrammeRenderers.actionIllustrationUrl(
                action, this.collectiveId, true
            );

        const logs = this.actionLogs
            .filter(l => l.programmeId === actionId)
            .sort((a, b) => {
                const dc = b.date.localeCompare(a.date);
                return dc !== 0 ? dc
                    : (b.time || '').localeCompare(a.time || '');
            });

        document.getElementById('history-body').innerHTML =
            ProgrammeRenderers.renderHistoryBody({
                logs, action, locale: this.locale,
                getMemberName: id => this.getMemberName(id)
            });

        this.historyModal.show();
    }

    // --- Utilitaire membre ---

    getMemberName(memberId) {
        return ActionUtils.getMemberName(memberId, this.members);
    }

    // --- Événements d'interface (liste) ---

    bindItemEvents() {
        const findDate = (actionId) => {
            const item = this.lastRenderedItems
                ?.find(i => i.data.id === actionId);
            return item ? item.nextDate : null;
        };

        document.querySelectorAll('.btn-mark-done').forEach(btn => {
            btn.addEventListener('click', () => {
                this.logForm.open(
                    btn.dataset.id, 'done', findDate(btn.dataset.id)
                );
            });
        });

        document.querySelectorAll('.btn-edit-log').forEach(btn => {
            btn.addEventListener('click', () => {
                this.logForm.open(
                    btn.dataset.id, 'done', findDate(btn.dataset.id)
                );
            });
        });

        document.querySelectorAll('.btn-edit-future').forEach(btn => {
            btn.addEventListener('click', () => {
                this.logForm.open(
                    btn.dataset.id, 'note', findDate(btn.dataset.id)
                );
            });
        });

        document.querySelectorAll('.btn-add-note').forEach(btn => {
            btn.addEventListener('click', () => {
                this.logForm.open(
                    btn.dataset.id, 'note', findDate(btn.dataset.id)
                );
            });
        });

        document.querySelectorAll('.btn-history').forEach(btn => {
            btn.addEventListener('click',
                () => this.openHistoryModal(btn.dataset.id));
        });

        document.querySelectorAll('.btn-edit-action').forEach(btn => {
            btn.addEventListener('click',
                () => this.actionForm.open(btn.dataset.id));
        });

        document.querySelectorAll('.btn-delete-action').forEach(btn => {
            btn.addEventListener('click',
                () => this.actionForm.delete(btn.dataset.id));
        });
    }

    // --- Onglets ---

    initTabs() {
        document.querySelectorAll('#programme-tabs a').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('#programme-tabs a')
                    .forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderContent(tab.dataset.tab);
            });
        });
    }

    // --- Init ---

    async init() {
        this.initTabs();

        // Mode vue (liste / semaine / mois)
        document.querySelectorAll('input[name="view-mode"]')
            .forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.viewMode = e.target.value;
                    this.renderContent();
                });
            });

        // Navigation calendrier
        document.getElementById('btn-prev-cal')
            .addEventListener('click', () => {
                if (this.viewMode === 'month') {
                    this.currentDate.setMonth(
                        this.currentDate.getMonth() - 1
                    );
                } else {
                    this.currentDate.setDate(
                        this.currentDate.getDate() - 7
                    );
                }
                this.renderContent();
            });

        document.getElementById('btn-next-cal')
            .addEventListener('click', () => {
                if (this.viewMode === 'month') {
                    this.currentDate.setMonth(
                        this.currentDate.getMonth() + 1
                    );
                } else {
                    this.currentDate.setDate(
                        this.currentDate.getDate() + 7
                    );
                }
                this.renderContent();
            });

        // Modal action (admin seulement)
        if (!this.isMember) {
            this.actionModal = new bootstrap.Modal(
                document.getElementById('actionModal')
            );
            this.actionForm = new ActionFormManager({ view: this });
            this.actionForm.initListeners();
        }

        // Modals accessibles à tous
        this.logModal = new bootstrap.Modal(
            document.getElementById('logModal')
        );
        this.historyModal = new bootstrap.Modal(
            document.getElementById('historyModal')
        );
        this.logForm = new LogFormManager({ view: this });
        this.logForm.initListeners();

        await this.loadData();
    }

    // --- Méthodes privées ---

    /** Calcule startCal, endCal et met à jour le label du calendrier */
    _computeCalendarRange() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const date = this.currentDate.getDate();
        let startCal, endCal;

        if (this.viewMode === 'month') {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            startCal = new Date(firstDay);
            let dow = startCal.getDay();
            startCal.setDate(
                startCal.getDate() - (dow === 0 ? 6 : dow - 1)
            );

            endCal = new Date(lastDay);
            dow = endCal.getDay();
            endCal.setDate(
                endCal.getDate() + (dow === 0 ? 0 : 7 - dow)
            );

            const monthName = firstDay.toLocaleDateString(this.locale, {
                month: 'long', year: 'numeric'
            });
            document.getElementById('calendar-label').textContent =
                monthName.charAt(0).toUpperCase() + monthName.slice(1);
        } else {
            startCal = new Date(year, month, date);
            let dow = startCal.getDay();
            startCal.setDate(
                startCal.getDate() - (dow === 0 ? 6 : dow - 1)
            );
            endCal = new Date(startCal);
            endCal.setDate(endCal.getDate() + 6);

            const sLabel = startCal.toLocaleDateString(this.locale, {
                day: 'numeric', month: 'short'
            });
            const eLabel = endCal.toLocaleDateString(this.locale, {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            document.getElementById('calendar-label').textContent =
                `${sLabel} - ${eLabel}`;
        }

        return { startCal, endCal, month };
    }

    /** Collecte les items (événements + actions) dans l'intervalle */
    _collectCalendarItems({ filter, startCal, endCal }) {
        const items = [];
        const startStr = RecurrenceUtils.formatDateStr(startCal);
        const endStr = RecurrenceUtils.formatDateStr(endCal);

        // Événements
        if (filter === 'all' || filter === 'events') {
            this.events.forEach(event => {
                const occurrences = window.RecurrenceUtils
                    ? RecurrenceUtils.generateOccurrences({
                        event,
                        startDate: new Date(
                            `${event.date || startStr}T12:00:00`
                        ),
                        maxOccurrences: 200
                    }) : [event];

                occurrences.forEach(occ => {
                    if (occ.occurrenceDate >= startStr
                        && occ.occurrenceDate <= endStr) {
                        items.push({
                            type: 'event',
                            data: event,
                            date: occ.occurrenceDate,
                            occurrence: occ
                        });
                    }
                });
            });
        }

        // Actions — résolution via ActionOccurrenceResolver
        if (filter === 'all' || filter === 'actions') {
            this.actions.forEach(rawAction => {
                const action = ActionUtils.normalize(rawAction, startStr);
                const resolved =
                    ActionOccurrenceResolver.resolveOccurrencesInRange({
                        action,
                        actionLogs: this.actionLogs,
                        startStr,
                        endStr
                    });
                items.push(...resolved);
            });
        }

        return items;
    }

    /** Attache les événements click sur les items du calendrier */
    _bindCalendarEvents(container) {
        container.querySelectorAll('.action-item-cal').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.btn-add-note-cal')) return;
                this.logForm.open(el.dataset.id, 'done', el.dataset.date);
            });
        });

        container.querySelectorAll('.btn-add-note-cal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.logForm.open(
                    btn.dataset.id, 'note', btn.dataset.date
                );
            });
        });
    }
}
