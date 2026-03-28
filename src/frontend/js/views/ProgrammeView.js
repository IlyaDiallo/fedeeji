class ProgrammeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("programme") + " - " + t("brand"));
        this.orgId = params.orgId;
        this.isMember = api.getRole() === 'member';
        this.events = [];
        this.actions = [];
        this.actionLogs = [];
        this.members = [];
    }

    async getHtml() {
        const addBtn = this.isMember ? '' : `
            <button class="btn btn-primary"
                id="btn-add-action">
                <i class="bi bi-plus-lg"></i>
                <span class="d-none d-md-inline"
                    data-i18n="add_action">
                    ${t("add_action")}</span>
            </button>`;

        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="programme">
                    ${t("programme")}</h2>
                ${addBtn}
            </div>

            <ul class="nav nav-tabs mb-3" id="programme-tabs">
                <li class="nav-item">
                    <a class="nav-link active"
                        href="#" data-tab="all">
                        ${t("all")}</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link"
                        href="#" data-tab="events">
                        ${t("events")}</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link"
                        href="#" data-tab="actions">
                        ${t("actions_label")}</a>
                </li>
            </ul>

            <div id="programme-list"
                class="list-group border-0">
            </div>

            <!-- Modal action -->
            <div class="modal fade" id="actionModal"
                tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="actionModalTitle">
                                ${t("add_edit_action")}</h5>
                            <button type="button"
                                class="btn-close"
                                data-bs-dismiss="modal">
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="action-form">
                                <input type="hidden"
                                    id="action-id">
                                <div class="mb-3">
                                    <label class="form-label">
                                        ${t("name")}</label>
                                    <input type="text"
                                        class="form-control"
                                        id="action-name"
                                        required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">
                                        Description</label>
                                    <textarea
                                        class="form-control"
                                        id="action-description">
                                    </textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="schedule_mode">
                                        ${t("schedule_mode")}
                                    </label>
                                    <div>
                                        <div class="form-check
                                            form-check-inline">
                                            <input
                                                class="form-check-input"
                                                type="radio"
                                                name="action-scheduleMode"
                                                id="mode-frequency"
                                                value="frequency"
                                                checked>
                                            <label
                                                class="form-check-label"
                                                for="mode-frequency">
                                                ${t("mode_frequency")}
                                            </label>
                                        </div>
                                        <div class="form-check
                                            form-check-inline">
                                            <input
                                                class="form-check-input"
                                                type="radio"
                                                name="action-scheduleMode"
                                                id="mode-scheduled"
                                                value="scheduled">
                                            <label
                                                class="form-check-label"
                                                for="mode-scheduled">
                                                ${t("mode_scheduled")}
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <!-- Champs fréquence -->
                                <div id="frequency-fields">
                                    <div class="mb-3">
                                        <label
                                            class="form-label"
                                            data-i18n="frequency">
                                            ${t("frequency")}
                                        </label>
                                        <div class="input-group">
                                            <span
                                                class="input-group-text">
                                                ${t("every")}
                                            </span>
                                            <input type="number"
                                                class="form-control"
                                                id="action-frequencyValue"
                                                min="1" value="1">
                                            <select
                                                class="form-select"
                                                id="action-frequencyUnit"
                                                style="max-width:140px">
                                                <option value="days">
                                                    ${t("days")}
                                                </option>
                                                <option value="months"
                                                    selected>
                                                    ${t("months_unit")}
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label
                                            class="form-label"
                                            data-i18n="window_days">
                                            ${t("window_days")}
                                        </label>
                                        <div class="input-group">
                                            <input type="number"
                                                class="form-control"
                                                id="action-windowDays"
                                                min="0" value="0">
                                            <span
                                                class="input-group-text">
                                                ${t("days_before")}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label
                                            class="form-label"
                                            data-i18n="start_date">
                                            ${t("start_date")}
                                        </label>
                                        <input type="date"
                                            class="form-control"
                                            id="action-startDate"
                                            required>
                                    </div>
                                </div>

                                <!-- Champs planning précis -->
                                <div id="scheduled-fields"
                                    style="display:none;">
                                    <div class="mb-3">
                                        <label
                                            class="form-label"
                                            data-i18n="date">
                                            ${t("date")}
                                        </label>
                                        <input type="date"
                                            class="form-control"
                                            id="action-date">
                                    </div>
                                    <div class="mb-3">
                                        <div class="form-check
                                            form-check-inline">
                                            <input
                                                class="form-check-input"
                                                type="radio"
                                                name="action-allDay"
                                                id="action-allDay-yes"
                                                value="yes" checked>
                                            <label
                                                class="form-check-label"
                                                for="action-allDay-yes">
                                                ${t("all_day")}
                                            </label>
                                        </div>
                                        <div class="form-check
                                            form-check-inline">
                                            <input
                                                class="form-check-input"
                                                type="radio"
                                                name="action-allDay"
                                                id="action-allDay-no"
                                                value="no">
                                            <label
                                                class="form-check-label"
                                                for="action-allDay-no">
                                                ${t("time_and_duration")}
                                            </label>
                                        </div>
                                    </div>
                                    <div
                                        id="action-time-duration"
                                        style="display:none;">
                                        <div class="mb-3">
                                            <label
                                                class="form-label">
                                                ${t("time")}
                                            </label>
                                            <input type="time"
                                                class="form-control"
                                                id="action-time">
                                        </div>
                                        <div class="mb-3">
                                            <label
                                                class="form-label">
                                                ${t("duration")}
                                            </label>
                                            <div
                                                class="input-group">
                                                <input
                                                    type="number"
                                                    class="form-control"
                                                    id="action-duration"
                                                    min="1">
                                                <select
                                                    class="form-select"
                                                    id="action-durationUnit"
                                                    style="max-width:140px">
                                                    <option
                                                        value="minutes">
                                                        ${t("minutes")}
                                                    </option>
                                                    <option
                                                        value="hours"
                                                        selected>
                                                        ${t("hours")}
                                                    </option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label
                                            class="form-label"
                                            data-i18n="recurrence">
                                            ${t("recurrence")}
                                        </label>
                                        <select
                                            class="form-select"
                                            id="action-recurrence">
                                            <option value="none">
                                                ${t("recurrence_none")}
                                            </option>
                                            <option value="weekly">
                                                ${t("recurrence_weekly")}
                                            </option>
                                            <option value="biweekly">
                                                ${t("recurrence_biweekly")}
                                            </option>
                                            <option value="monthly">
                                                ${t("recurrence_monthly")}
                                            </option>
                                        </select>
                                    </div>
                                    <div class="mb-3"
                                        id="action-recurrence-days-container"
                                        style="display:none;">
                                        <label
                                            class="form-label">
                                            ${t("recurrence_days")}
                                        </label>
                                        <div>
                                            ${[1,2,3,4,5,6,0].map(d => `
                                            <div class="form-check
                                                form-check-inline">
                                                <input
                                                    class="form-check-input
                                                    action-recurrence-day"
                                                    type="checkbox"
                                                    id="action-rec-day-${d}"
                                                    value="${d}">
                                                <label
                                                    class="form-check-label"
                                                    for="action-rec-day-${d}">
                                                    ${t("day_" + d)}
                                                </label>
                                            </div>`).join('')}
                                        </div>
                                    </div>
                                    <div class="mb-3"
                                        id="action-monthly-type-container"
                                        style="display:none;">
                                        <label
                                            class="form-label">
                                            ${t("monthly_type")}
                                        </label>
                                        <select
                                            class="form-select"
                                            id="action-monthlyType">
                                            <option value="date">
                                                ${t("monthly_type_date")}
                                            </option>
                                            <option value="first_day">
                                                ${t("monthly_type_first")}
                                            </option>
                                            <option value="last_day">
                                                ${t("monthly_type_last")}
                                            </option>
                                            <option
                                                value="nth_weekday">
                                                ${t("monthly_type_weekday")}
                                            </option>
                                        </select>
                                    </div>
                                    <div class="mb-3"
                                        id="action-recurrence-end-container"
                                        style="display:none;">
                                        <label
                                            class="form-label">
                                            ${t("recurrence_end_date")}
                                        </label>
                                        <input type="date"
                                            class="form-control"
                                            id="action-recurrenceEndDate">
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal"
                                data-i18n="cancel">
                                ${t("cancel")}</button>
                            <button type="button"
                                class="btn btn-primary"
                                id="btn-save-action"
                                data-i18n="save">
                                ${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal log (Fait !) -->
            <div class="modal fade" id="logModal"
                tabindex="-1">
                <div class="modal-dialog modal-sm">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                ${t("mark_done")}</h5>
                            <button type="button"
                                class="btn-close"
                                data-bs-dismiss="modal">
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="log-form">
                                <input type="hidden"
                                    id="log-actionId">
                                <div class="mb-3">
                                    <label
                                        class="form-label">
                                        ${t("date")}
                                    </label>
                                    <input type="date"
                                        class="form-control"
                                        id="log-date"
                                        required>
                                </div>
                                <div class="mb-3">
                                    <label
                                        class="form-label">
                                        ${t("notes")}
                                    </label>
                                    <input type="text"
                                        class="form-control"
                                        id="log-notes">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal">
                                ${t("cancel")}</button>
                            <button type="button"
                                class="btn btn-success"
                                id="btn-save-log">
                                ${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal historique -->
            <div class="modal fade" id="historyModal"
                tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="historyModalTitle">
                                ${t("history")}</h5>
                            <button type="button"
                                class="btn-close"
                                data-bs-dismiss="modal">
                            </button>
                        </div>
                        <div class="modal-body"
                            id="history-body">
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal">
                                ${t("close")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Chargement des données ---

    async loadData() {
        try {
            const [events, actions, actionLogs] =
                await Promise.all([
                    api.get(this.orgId, 'events'),
                    api.get(this.orgId, 'actions'),
                    api.get(this.orgId, 'action-logs')
                ]);
            this.events = events || [];
            this.actions = actions || [];
            this.actionLogs = actionLogs || [];
            if (!this.isMember) {
                this.members = await api.get(
                    this.orgId, 'members'
                );
            }
        } catch (error) {
            this.events = [];
            this.actions = [];
            this.actionLogs = [];
            this.members = [];
        }
        this.renderList();
    }

    // --- Calcul d'échéance pour les actions en mode fréquence ---

    computeFrequencyStatus(action) {
        const logs = this.actionLogs
            .filter(l => l.programmeId === action.id)
            .sort((a, b) => b.date.localeCompare(a.date));
        const lastLog = logs[0] || null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = RecurrenceUtils.formatDateStr(today);

        let deadline;
        if (lastLog) {
            deadline = this.addFrequency(
                new Date(`${lastLog.date}T12:00:00`),
                action.frequencyValue,
                action.frequencyUnit
            );
        } else {
            // Pas encore réalisé : échéance = startDate + fréquence
            const start = action.startDate
                ? new Date(`${action.startDate}T12:00:00`)
                : today;
            deadline = this.addFrequency(
                start,
                action.frequencyValue,
                action.frequencyUnit
            );
        }

        const deadlineStr =
            RecurrenceUtils.formatDateStr(deadline);
        const windowStart = new Date(deadline);
        windowStart.setDate(
            windowStart.getDate()
            - (action.windowDays || 0)
        );
        const windowStartStr =
            RecurrenceUtils.formatDateStr(windowStart);

        let status;
        if (todayStr > deadlineStr) {
            status = 'overdue';
        } else if (todayStr >= windowStartStr) {
            status = 'due';
        } else {
            status = 'ok';
        }

        return {
            deadline, deadlineStr,
            windowStart, windowStartStr,
            lastLog, status
        };
    }

    addFrequency(dateObj, value, unit) {
        const result = new Date(dateObj);
        if (unit === 'days') {
            result.setDate(result.getDate() + value);
        } else if (unit === 'months') {
            result.setMonth(result.getMonth() + value);
        }
        return result;
    }

    // --- Rendu de la liste unifiée ---

    renderList(filter = 'all') {
        const container =
            document.getElementById('programme-list');
        container.innerHTML = '';

        const items = [];
        const now = new Date();
        const todayStr =
            RecurrenceUtils.formatDateStr(now);
        const locale =
            i18n.lang === 'en' ? 'en-US' : 'fr-FR';

        // Événements
        if (filter === 'all' || filter === 'events') {
            this.events.forEach(event => {
                const occurrences =
                    window.RecurrenceUtils
                        ? RecurrenceUtils
                            .generateOccurrences({
                                event, startDate: now
                            })
                        : [event];
                const future = (occurrences || [])
                    .filter(
                        o => o.occurrenceDate >= todayStr
                    );
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

        // Actions
        if (filter === 'all' || filter === 'actions') {
            this.actions.forEach(action => {
                if (action.scheduleMode === 'scheduled') {
                    // Actions planifiées : même logique
                    const occurrences =
                        RecurrenceUtils
                            .generateOccurrences({
                                event: action,
                                startDate: now
                            });
                    const future = (occurrences || [])
                        .filter(
                            o => o.occurrenceDate
                                >= todayStr
                        );
                    if (future.length > 0) {
                        items.push({
                            type: 'action-scheduled',
                            data: action,
                            nextDate:
                                future[0].occurrenceDate,
                            occurrence: future[0]
                        });
                    }
                } else {
                    // Actions fréquence
                    const info =
                        this.computeFrequencyStatus(
                            action
                        );
                    items.push({
                        type: 'action-frequency',
                        data: action,
                        nextDate: info.deadlineStr,
                        freqInfo: info
                    });
                }
            });
        }

        // Tri par prochaine date
        items.sort((a, b) =>
            a.nextDate.localeCompare(b.nextDate)
        );

        if (items.length === 0) {
            container.innerHTML = `
                <p class="text-muted">
                    ${t("no_programme_items")}</p>`;
            return;
        }

        items.forEach(item => {
            const el = this.renderItem(item, locale);
            container.appendChild(el);
        });

        this.bindItemEvents();
    }

    renderItem(item, locale) {
        const div = document.createElement('div');
        div.className =
            'list-group-item border rounded mb-2';

        if (item.type === 'event') {
            div.innerHTML =
                this.renderEventItem(item, locale);
        } else if (item.type === 'action-scheduled') {
            div.innerHTML =
                this.renderScheduledActionItem(
                    item, locale
                );
        } else {
            div.innerHTML =
                this.renderFrequencyActionItem(
                    item, locale
                );
        }
        return div;
    }

    renderEventItem(item, locale) {
        const event = item.data;
        const occ = item.occurrence;
        const dateStr = new Date(occ.occurrenceDate)
            .toLocaleDateString(locale, {
                weekday: 'long', year: 'numeric',
                month: 'long', day: 'numeric'
            });
        const isAllDay = event.allDay !== undefined
            ? event.allDay : !event.time;
        const timeStr = isAllDay
            ? '' : ` ⏰ ${event.time || ''}`;
        const isRecurrent = event.recurrence
            && event.recurrence !== 'none';
        const cancelledLabel = occ.isCancelled
            ? ` <span class="badge bg-danger ms-1">${t("occurrence_cancelled")}</span>`
            : '';

        const inscLink = isRecurrent
            ? `<a href="/${this.orgId}/events/${event.id}/inscription-schedule"
                class="btn btn-sm btn-outline-primary ms-1"
                data-link title="${t("plan_inscriptions")}">
                <i class="bi bi-calendar-check"></i></a>`
            : `<a href="/${this.orgId}/inscriptions?eventId=${event.id}&date=${occ.occurrenceDate}"
                class="btn btn-sm btn-outline-success ms-1"
                data-link title="${t("inscriptions")}">
                <i class="bi bi-calendar-plus"></i></a>`;

        return `
            <div class="d-flex w-100
                justify-content-between
                align-items-center">
                <div class="ms-2 me-auto">
                    <div class="fw-bold text-primary
                        d-flex align-items-center">
                        <span class="badge bg-info me-2">
                            📅 ${t("event")}</span>
                        ${event.name}${cancelledLabel}
                    </div>
                    <div class="text-muted mt-1">
                        <small>
                            🗓️ ${dateStr}${timeStr}
                        </small>
                    </div>
                    ${event.description ? `
                    <div class="mt-1 text-dark small">
                        ${event.description}
                    </div>` : ''}
                </div>
                <div class="d-flex align-items-center">
                    ${inscLink}
                </div>
            </div>`;
    }

    renderScheduledActionItem(item, locale) {
        const action = item.data;
        const occ = item.occurrence;
        const dateStr = new Date(occ.occurrenceDate)
            .toLocaleDateString(locale, {
                weekday: 'long', year: 'numeric',
                month: 'long', day: 'numeric'
            });
        const isAllDay = action.allDay !== undefined
            ? action.allDay : !action.time;
        const timeStr = isAllDay
            ? '' : ` ⏰ ${action.time || ''}`;
        const cancelledLabel = occ.isCancelled
            ? ` <span class="badge bg-danger ms-1">${t("occurrence_cancelled")}</span>`
            : '';

        const logs = this.actionLogs
            .filter(l => l.programmeId === action.id);
        const lastLog = logs.length > 0
            ? logs.sort(
                (a, b) => b.date.localeCompare(a.date)
            )[0] : null;

        const adminBtns = this.isMember ? '' : `
            <button class="btn btn-sm
                btn-outline-primary btn-edit-action ms-1"
                data-id="${action.id}"
                title="${t("edit")}">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm
                btn-outline-danger btn-delete-action ms-1"
                data-id="${action.id}"
                title="${t("delete")}">
                <i class="bi bi-trash"></i>
            </button>`;

        return `
            <div class="d-flex w-100
                justify-content-between
                align-items-center">
                <div class="ms-2 me-auto">
                    <div class="fw-bold
                        d-flex align-items-center">
                        <span class="badge
                            bg-warning text-dark me-2">
                            🔧 ${t("action_label")}
                        </span>
                        ${action.name}${cancelledLabel}
                    </div>
                    <div class="text-muted mt-1">
                        <small>
                            🗓️ ${dateStr}${timeStr}
                        </small>
                    </div>
                    ${action.description ? `
                    <div class="mt-1 text-dark small">
                        ${action.description}
                    </div>` : ''}
                    ${lastLog ? `
                    <div class="mt-1 small text-success">
                        ✅ ${t("last_done")}
                        ${lastLog.date}
                        ${this.getMemberName(
                            lastLog.memberId
                        )}
                    </div>` : ''}
                </div>
                <div class="d-flex align-items-center">
                    <button class="btn btn-sm
                        btn-success btn-mark-done ms-1"
                        data-id="${action.id}"
                        title="${t("mark_done")}">
                        ✅
                    </button>
                    <button class="btn btn-sm
                        btn-outline-secondary
                        btn-history ms-1"
                        data-id="${action.id}"
                        title="${t("history")}">
                        <i class="bi bi-clock-history">
                        </i>
                    </button>
                    ${adminBtns}
                </div>
            </div>`;
    }

    renderFrequencyActionItem(item, locale) {
        const action = item.data;
        const info = item.freqInfo;

        const deadlineDateStr =
            new Date(info.deadlineStr + 'T12:00:00')
                .toLocaleDateString(locale, {
                    weekday: 'long', year: 'numeric',
                    month: 'long', day: 'numeric'
                });

        // Étiquette de fréquence
        const freqLabel =
            `${action.frequencyValue} ${t(action.frequencyUnit === 'days' ? 'days' : 'months_unit').toLowerCase()}`;

        let statusBadge;
        if (info.status === 'overdue') {
            statusBadge = `<span class="badge bg-danger
                ms-2">🔴 ${t("overdue")}</span>`;
        } else if (info.status === 'due') {
            statusBadge = `<span class="badge bg-warning
                text-dark ms-2">
                🟡 ${t("due_now")}</span>`;
        } else {
            statusBadge = `<span class="badge bg-success
                ms-2">🟢 ${t("status_ok")}</span>`;
        }

        const lastLogStr = info.lastLog
            ? `✅ ${t("last_done")} ${info.lastLog.date} ${this.getMemberName(info.lastLog.memberId)}`
            : `⚠️ ${t("never_done")}`;

        const canDo =
            info.status === 'due'
            || info.status === 'overdue';

        const doneBtn = canDo
            ? `<button class="btn btn-sm
                btn-success btn-mark-done ms-1"
                data-id="${action.id}"
                title="${t("mark_done")}">
                ✅</button>`
            : `<button class="btn btn-sm
                btn-outline-secondary ms-1"
                disabled title="${t("not_yet_due")}">
                ✅</button>`;

        const adminBtns = this.isMember ? '' : `
            <button class="btn btn-sm
                btn-outline-primary btn-edit-action ms-1"
                data-id="${action.id}"
                title="${t("edit")}">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm
                btn-outline-danger btn-delete-action ms-1"
                data-id="${action.id}"
                title="${t("delete")}">
                <i class="bi bi-trash"></i>
            </button>`;

        return `
            <div class="d-flex w-100
                justify-content-between
                align-items-center">
                <div class="ms-2 me-auto">
                    <div class="fw-bold
                        d-flex align-items-center
                        flex-wrap">
                        <span class="badge
                            bg-warning text-dark me-2">
                            🔧 ${t("action_label")}
                        </span>
                        ${action.name}
                        ${statusBadge}
                    </div>
                    <div class="text-muted mt-1">
                        <small>
                            🔄 ${t("every")}
                            ${freqLabel}
                            &nbsp;|&nbsp;
                            📅 ${t("deadline")}
                            ${deadlineDateStr}
                            ${action.windowDays > 0
                                ? `&nbsp;|&nbsp; 🪟 ${t("window")} ${action.windowDays}${t("days_short")}`
                                : ''}
                        </small>
                    </div>
                    ${action.description ? `
                    <div class="mt-1 text-dark small">
                        ${action.description}
                    </div>` : ''}
                    <div class="mt-1 small
                        ${info.lastLog
                            ? 'text-success'
                            : 'text-muted'}">
                        ${lastLogStr}
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    ${doneBtn}
                    <button class="btn btn-sm
                        btn-outline-secondary
                        btn-history ms-1"
                        data-id="${action.id}"
                        title="${t("history")}">
                        <i class="bi bi-clock-history">
                        </i>
                    </button>
                    ${adminBtns}
                </div>
            </div>`;
    }

    getMemberName(memberId) {
        if (!memberId) return '';
        const m = this.members.find(
            m => m.id === memberId
        );
        if (!m) return '';
        return `(${m.firstName || ''} ${m.lastName || ''})`.trim();
    }

    // --- Événements d'interface ---

    bindItemEvents() {
        // Bouton "Fait !"
        document.querySelectorAll('.btn-mark-done')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    this.openLogModal(btn.dataset.id);
                });
            });

        // Bouton historique
        document.querySelectorAll('.btn-history')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    this.openHistoryModal(
                        btn.dataset.id
                    );
                });
            });

        // Admin : éditer action
        document.querySelectorAll('.btn-edit-action')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    this.openActionModal(btn.dataset.id);
                });
            });

        // Admin : supprimer action
        document.querySelectorAll('.btn-delete-action')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    this.deleteAction(btn.dataset.id);
                });
            });
    }

    // --- Onglets ---

    initTabs() {
        document.querySelectorAll(
            '#programme-tabs a'
        ).forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll(
                    '#programme-tabs a'
                ).forEach(
                    t => t.classList.remove('active')
                );
                tab.classList.add('active');
                this.renderList(tab.dataset.tab);
            });
        });
    }

    // --- Modal action (CRUD) ---

    toggleScheduleMode() {
        const isFrequency =
            document.getElementById(
                'mode-frequency'
            ).checked;
        document.getElementById(
            'frequency-fields'
        ).style.display =
            isFrequency ? 'block' : 'none';
        document.getElementById(
            'scheduled-fields'
        ).style.display =
            isFrequency ? 'none' : 'block';
    }

    toggleActionAllDay() {
        const isAllDay =
            document.getElementById(
                'action-allDay-yes'
            ).checked;
        document.getElementById(
            'action-time-duration'
        ).style.display =
            isAllDay ? 'none' : 'block';
    }

    openActionModal(id = null) {
        const form =
            document.getElementById('action-form');
        form.reset();
        document.getElementById('action-id').value = '';
        document.getElementById(
            'mode-frequency'
        ).checked = true;
        this.toggleScheduleMode();
        this.toggleActionAllDay();

        // Réinitialiser les champs de récurrence
        document.getElementById(
            'action-recurrence'
        ).value = 'none';
        document.getElementById(
            'action-recurrence-days-container'
        ).style.display = 'none';
        document.getElementById(
            'action-monthly-type-container'
        ).style.display = 'none';
        document.getElementById(
            'action-recurrence-end-container'
        ).style.display = 'none';
        document.querySelectorAll(
            '.action-recurrence-day'
        ).forEach(cb => cb.checked = false);

        if (id) {
            const action = this.actions.find(
                a => a.id === id
            );
            if (!action) return;

            document.getElementById(
                'action-id'
            ).value = action.id;
            document.getElementById(
                'action-name'
            ).value = action.name || '';
            document.getElementById(
                'action-description'
            ).value = action.description || '';

            const isScheduled =
                action.scheduleMode === 'scheduled';
            document.getElementById(
                'mode-frequency'
            ).checked = !isScheduled;
            document.getElementById(
                'mode-scheduled'
            ).checked = isScheduled;
            this.toggleScheduleMode();

            if (isScheduled) {
                document.getElementById(
                    'action-date'
                ).value = action.date || '';
                const isAllDay =
                    action.allDay !== undefined
                        ? action.allDay : !action.time;
                document.getElementById(
                    'action-allDay-yes'
                ).checked = isAllDay;
                document.getElementById(
                    'action-allDay-no'
                ).checked = !isAllDay;
                this.toggleActionAllDay();
                document.getElementById(
                    'action-time'
                ).value = action.time || '';
                document.getElementById(
                    'action-duration'
                ).value = action.duration || '';
                document.getElementById(
                    'action-durationUnit'
                ).value = action.durationUnit || 'hours';
                document.getElementById(
                    'action-recurrence'
                ).value = action.recurrence || 'none';
                document.getElementById(
                    'action-recurrenceEndDate'
                ).value = action.recurrenceEndDate || '';
                document.getElementById(
                    'action-monthlyType'
                ).value = action.monthlyType || 'date';
                document.querySelectorAll(
                    '.action-recurrence-day'
                ).forEach(cb => {
                    cb.checked =
                        action.recurrenceDays
                            ? action.recurrenceDays
                                .includes(
                                    parseInt(cb.value)
                                )
                            : false;
                });
                const rec =
                    action.recurrence || 'none';
                document.getElementById(
                    'action-recurrence-end-container'
                ).style.display =
                    rec !== 'none' ? 'block' : 'none';
                document.getElementById(
                    'action-recurrence-days-container'
                ).style.display =
                    (rec === 'weekly'
                        || rec === 'biweekly')
                        ? 'block' : 'none';
                document.getElementById(
                    'action-monthly-type-container'
                ).style.display =
                    rec === 'monthly'
                        ? 'block' : 'none';
            } else {
                document.getElementById(
                    'action-frequencyValue'
                ).value = action.frequencyValue || 1;
                document.getElementById(
                    'action-frequencyUnit'
                ).value =
                    action.frequencyUnit || 'months';
                document.getElementById(
                    'action-windowDays'
                ).value = action.windowDays || 0;
                document.getElementById(
                    'action-startDate'
                ).value = action.startDate || '';
            }
        }

        this.actionModal.show();
    }

    async saveAction() {
        const form =
            document.getElementById('action-form');
        if (!form.reportValidity()) return;

        const id = document.getElementById(
            'action-id'
        ).value;
        const isScheduled = document.getElementById(
            'mode-scheduled'
        ).checked;

        const data = {
            name: document.getElementById(
                'action-name'
            ).value,
            description: document.getElementById(
                'action-description'
            ).value,
            scheduleMode: isScheduled
                ? 'scheduled' : 'frequency'
        };

        if (isScheduled) {
            const isAllDay = document.getElementById(
                'action-allDay-yes'
            ).checked;
            Object.assign(data, {
                date: document.getElementById(
                    'action-date'
                ).value,
                allDay: isAllDay,
                time: isAllDay ? '' :
                    document.getElementById(
                        'action-time'
                    ).value,
                duration: isAllDay ? null : Number(
                    document.getElementById(
                        'action-duration'
                    ).value
                ),
                durationUnit: isAllDay ? null :
                    document.getElementById(
                        'action-durationUnit'
                    ).value,
                recurrence: document.getElementById(
                    'action-recurrence'
                ).value,
                recurrenceEndDate:
                    document.getElementById(
                        'action-recurrenceEndDate'
                    ).value || null,
                recurrenceDays: Array.from(
                    document.querySelectorAll(
                        '.action-recurrence-day:checked'
                    )
                ).map(cb => parseInt(cb.value)),
                monthlyType: document.getElementById(
                    'action-monthlyType'
                ).value,
                // Nettoyer les champs fréquence
                frequencyValue: null,
                frequencyUnit: null,
                windowDays: null,
                startDate: null
            });
        } else {
            Object.assign(data, {
                frequencyValue: Number(
                    document.getElementById(
                        'action-frequencyValue'
                    ).value
                ),
                frequencyUnit:
                    document.getElementById(
                        'action-frequencyUnit'
                    ).value,
                windowDays: Number(
                    document.getElementById(
                        'action-windowDays'
                    ).value
                ),
                startDate: document.getElementById(
                    'action-startDate'
                ).value,
                // Nettoyer les champs planifiés
                date: null, time: null,
                allDay: null, duration: null,
                durationUnit: null,
                recurrence: null,
                recurrenceEndDate: null,
                recurrenceDays: null,
                monthlyType: null,
                cancelledDates: null
            });
        }

        try {
            if (id) {
                await api.update(
                    this.orgId, 'actions', id, data
                );
            } else {
                await api.create(
                    this.orgId, 'actions', data
                );
            }
            this.actionModal.hide();
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    async deleteAction(id) {
        if (!confirm(t("confirm_delete"))) return;
        try {
            await api.delete(
                this.orgId, 'actions', id
            );
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Modal log (Fait !) ---

    openLogModal(actionId) {
        document.getElementById(
            'log-actionId'
        ).value = actionId;
        document.getElementById(
            'log-date'
        ).value = RecurrenceUtils.formatDateStr(
            new Date()
        );
        document.getElementById(
            'log-notes'
        ).value = '';
        this.logModal.show();
    }

    async saveLog() {
        const actionId = document.getElementById(
            'log-actionId'
        ).value;
        const date = document.getElementById(
            'log-date'
        ).value;
        const notes = document.getElementById(
            'log-notes'
        ).value;
        if (!date) return;

        try {
            await api.create(
                this.orgId, 'action-logs', {
                    programmeId: actionId,
                    memberId: api.getMemberId(),
                    date,
                    notes
                }
            );
            this.logModal.hide();
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Modal historique ---

    openHistoryModal(actionId) {
        const action = this.actions.find(
            a => a.id === actionId
        );
        const title = document.getElementById(
            'historyModalTitle'
        );
        title.textContent =
            `${t("history")} — ${action?.name || ''}`;

        const logs = this.actionLogs
            .filter(l => l.programmeId === actionId)
            .sort(
                (a, b) => b.date.localeCompare(a.date)
            );

        const body =
            document.getElementById('history-body');

        if (logs.length === 0) {
            body.innerHTML = `
                <p class="text-muted">
                    ${t("no_history")}</p>`;
        } else {
            const locale =
                i18n.lang === 'en' ? 'en-US' : 'fr-FR';
            body.innerHTML = `
                <div class="list-group">
                    ${logs.map(log => {
                        const dateStr =
                            new Date(log.date + 'T12:00:00')
                                .toLocaleDateString(
                                    locale,
                                    {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    }
                                );
                        const memberName =
                            this.getMemberName(
                                log.memberId
                            );
                        return `
                        <div class="list-group-item">
                            <div class="d-flex
                                justify-content-between">
                                <strong>
                                    ${dateStr}
                                </strong>
                                <small
                                    class="text-muted">
                                    ${memberName}
                                </small>
                            </div>
                            ${log.notes ? `
                            <small class="text-muted">
                                ${log.notes}
                            </small>` : ''}
                        </div>`;
                    }).join('')}
                </div>`;
        }

        this.historyModal.show();
    }

    // --- Init ---

    async init() {
        this.initTabs();

        if (!this.isMember) {
            this.actionModal = new bootstrap.Modal(
                document.getElementById('actionModal')
            );

            document.getElementById('btn-add-action')
                .addEventListener('click', () => {
                    this.openActionModal();
                });

            document.getElementById('btn-save-action')
                .addEventListener('click', () => {
                    this.saveAction();
                });

            // Toggle mode planification
            document.querySelectorAll(
                'input[name="action-scheduleMode"]'
            ).forEach(radio => {
                radio.addEventListener('change', () => {
                    this.toggleScheduleMode();
                });
            });

            // Toggle journée entière
            document.querySelectorAll(
                'input[name="action-allDay"]'
            ).forEach(radio => {
                radio.addEventListener('change', () => {
                    this.toggleActionAllDay();
                });
            });

            // Toggle récurrence
            const recSel = document.getElementById(
                'action-recurrence'
            );
            if (recSel) {
                recSel.addEventListener(
                    'change', (e) => {
                        const val = e.target.value;
                        document.getElementById(
                            'action-recurrence-end-container'
                        ).style.display =
                            val !== 'none'
                                ? 'block' : 'none';
                        document.getElementById(
                            'action-recurrence-days-container'
                        ).style.display =
                            (val === 'weekly'
                                || val === 'biweekly')
                                ? 'block' : 'none';
                        document.getElementById(
                            'action-monthly-type-container'
                        ).style.display =
                            val === 'monthly'
                                ? 'block' : 'none';
                    }
                );
            }
        }

        // Modals accessibles à tous
        this.logModal = new bootstrap.Modal(
            document.getElementById('logModal')
        );
        this.historyModal = new bootstrap.Modal(
            document.getElementById('historyModal')
        );

        document.getElementById('btn-save-log')
            .addEventListener('click', () => {
                this.saveLog();
            });

        await this.loadData();
    }
}
